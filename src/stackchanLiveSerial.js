const PREFIX="INARI_LIVE_V1 ";
const ACK="INARI_LIVE_ACK ";
const $=(id)=>document.getElementById(id);

export function createLiveSerial(getFrame,onProfile=()=>{},onStart=()=>{}) {
  let port=null, reader=null, writer=null, connected=false, active=false, buffer="", lastSent=0, sending=false, uploadBusy=false;
  let profileSupported=false,profileRetry=false,lastProfileAt=0;
  const pending=new Map();
  const status=(message)=>{$("serialStatus").textContent=message;};
  function buttons() {
    $("serialConnect").disabled=uploadBusy||connected;
    $("serialStart").disabled=uploadBusy||!connected||active;
    $("serialStop").disabled=uploadBusy||!active;
    $("serialDisconnect").disabled=uploadBusy||!port;
  }
  function failPending(message) {
    for (const [,entry] of pending) { clearTimeout(entry.timer); entry.reject(new Error(message)); }
    pending.clear();
  }
  async function readLoop() {
    const decoder=new TextDecoder();
    try {
      while (port?.readable) {
        reader=port.readable.getReader();
        try {
          while (true) {
            const {value,done}=await reader.read(); if (done) break;
            buffer+=decoder.decode(value,{stream:true});
            if (buffer.length>4096) buffer="";
            let end;
            while ((end=buffer.indexOf("\n"))>=0) {
              const line=buffer.slice(0,end).trim(); buffer=buffer.slice(end+1);
              if (!line.startsWith(ACK)) continue;
              let reply; try { reply=JSON.parse(line.slice(ACK.length)); } catch { continue; }
              if (reply.cmd==="frame") {
                if (!reply.ok) {
                  active=false; buttons(); status(`実機プレビューを停止しました: ${reply.reason||"通信エラー"}`);
                } else if (reply.reason==="face_only") {
                  status("顔を実機へ反映中。首サーボは利用できません。");
                }
              }
              if (reply.cmd==="end" && reply.reason==="timeout") {
                active=false; buttons(); status("通信が5秒止まり、実機は通常動作へ戻りました。");
              }
              const entry=pending.get(reply.cmd);
              if (entry) { pending.delete(reply.cmd); clearTimeout(entry.timer); reply.ok?entry.resolve(reply):entry.reject(new Error(reply.reason||"実機が操作を拒否しました。")); }
            }
          }
        } finally { reader.releaseLock(); reader=null; }
        break;
      }
    } catch (error) { status(error instanceof Error?error.message:"USB通信が終了しました。"); }
    connected=false; active=false; buttons(); failPending("USB通信が終了しました。");
  }
  async function send(cmd,data={}) {
    if (!writer) throw new Error("USB接続がありません。");
    await writer.write(new TextEncoder().encode(PREFIX+JSON.stringify({cmd,...data})+"\n"));
  }
  async function request(cmd,data={}) {
    const answer=new Promise((resolve,reject)=>{
      const timer=setTimeout(()=>{pending.delete(cmd);reject(new Error("実機から応答がありません。"));},1800);
      pending.set(cmd,{resolve,reject,timer});
    });
    try { await send(cmd,data); return await answer; }
    catch(error) { const entry=pending.get(cmd); if (entry) {clearTimeout(entry.timer);pending.delete(cmd);} throw error; }
  }
  async function waitForBootHello() {
    let lastError;
    for (let attempt=0; attempt<12; attempt++) {
      if (!port?.readable) throw new Error("USB通信が終了しました。");
      try { return await request("hello"); }
      catch(error) {
        if (!(error instanceof Error) || error.message!=="実機から応答がありません。") throw error;
        lastError=error;
      }
    }
    throw lastError ?? new Error("Stack-chanの起動を確認できませんでした。");
  }
  async function close() {
    active=false; connected=false; buttons();
    try { if (reader) await reader.cancel(); } catch { /* Port can already be gone. */ }
    try { if (writer) {writer.releaseLock();writer=null;} await port?.close(); } catch { /* Disconnected. */ }
    port=null;
  }
  $("serialConnect").addEventListener("click",async()=>{
    if (!navigator.serial) {status("Web Serial対応のChromeでlocalhostを開いてください。");return;}
    try {
      port=await navigator.serial.requestPort({filters:[{usbVendorId:0x303a}]});
      await port.open({baudRate:115200});
      writer=port.writable.getWriter(); readLoop();
      status("Stack-chanの起動を待っています…（最大約22秒）");
      const hello=await waitForBootHello();
      if (hello.device!=="stack-chan") throw new Error("接続先をStack-chanと確認できませんでした。");
      // `hello` reports whether live preview currently owns the neck. The
      // firmware sets that flag only after `begin`, so an idle false is normal.
      connected=true; buttons();
      status("Stack-chanを識別しました。実機プレビューを開始すると首サーボの状態を確認します。");
      for(let attempt=0;attempt<3;attempt++) {
        try {
          const profile=await request("profile");profileSupported=true;profileRetry=false;onProfile(profile);
          if(!active) status("Stack-chanを識別し、実機の可動範囲を取得しました。");
          break;
        }
        catch(error) {
          profileSupported=false;
          profileRetry=error instanceof Error && ["motion_unavailable","実機から応答がありません。"].includes(error.message);
          if(!profileRetry || attempt===2) {
            status(`実機の可動範囲を読み取れませんでした: ${error instanceof Error?error.message:"応答なし"}`);
            break;
          }
          await new Promise((resolve)=>setTimeout(resolve,600));
        }
      }
    } catch(error) {status(error instanceof Error?error.message:"USB接続に失敗しました。");await close();}
  });
  $("serialStart").addEventListener("click",async()=>{
    $("serialStart").disabled=true;
    try {
      let reply;
      for(let attempt=0;attempt<4;attempt++) {
        try { reply=await request("begin"); }
        catch(error) {
          if(error instanceof Error && error.message==="busy" && attempt<3) {
            await new Promise((resolve)=>setTimeout(resolve,700)); continue;
          }
          throw error;
        }
        if(reply.neckReady!==false || attempt===3) break;
        try {await request("end");} catch { /* The next begin checks readiness again. */ }
        await new Promise((resolve)=>setTimeout(resolve,700));
      }
      // A long-running browser preview may have reached its 30-second neck
      // safety stop while the user was choosing a USB port. Begin a fresh
      // episode when the device actually accepts live preview.
      onStart();
      active=true;lastSent=0;lastProfileAt=0;buttons();status(reply.neckReady===false
        ? "実機プレビュー中。首サーボは利用できず、顔のみ反映します。"
        : "実機プレビュー中。顔と首を最大5回/秒で送信します。");
    }
    catch(error) {status(error.message);}
    finally {buttons();}
  });
  $("serialStop").addEventListener("click",async()=>{
    active=false;buttons();
    try {await request("end");status("実機プレビューを終了しました。");}
    catch(error) {status(error.message);}
  });
  $("serialDisconnect").addEventListener("click",async()=>{
    if(active){try{await request("end");}catch{/* USBを閉じても5秒で通常動作に戻る。*/}}
    await close();status("USB接続を解放しました。実機への書き込みを開始できます。");
  });
  navigator.serial?.addEventListener("disconnect",()=>{close();status("USB接続が切れました。実機は自動で通常動作へ戻ります。");});
  buttons();
  return {
    async prepareUpload() {
      uploadBusy=true; buttons();
      if (active) {
        active=false; buttons();
        try { await request("end"); } catch { /* Closing the port also ends the timed preview. */ }
      }
      if (port) await close();
      status("書き込みのためUSB接続を解放しました。");
    },
    finishUpload() { uploadBusy=false; buttons(); },
    tick(now) {
      if(active&&(profileSupported||profileRetry)&&now-lastProfileAt>=(profileSupported?1000:3000)&&!pending.has("profile")) {
        lastProfileAt=now;
        request("profile").then((profile)=>{profileSupported=true;profileRetry=false;onProfile(profile);})
          .catch((error)=>{profileSupported=false;profileRetry=error instanceof Error&&["motion_unavailable","実機から応答がありません。"].includes(error.message);});
      }
      if (!active||sending||now-lastSent<200) return;
      lastSent=now; sending=true;
      send("frame",getFrame()).catch((error)=>{active=false;buttons();status(error.message);})
        .finally(()=>{sending=false;});
    },
  };
}
