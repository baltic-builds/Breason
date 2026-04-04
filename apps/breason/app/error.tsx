"use client";

export default function Error({
  error,
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@700&family=DM+Sans:wght@400;500&display=swap');
        body{margin:0;background:#09090B;font-family:'DM Sans',system-ui,sans-serif}
        .wrap{min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px}
        .box{background:#111113;border:1px solid rgba(255,255,255,0.07);border-radius:14px;padding:36px 40px;max-width:480px;width:100%;text-align:center}
        .icon{font-size:32px;margin-bottom:16px}
        h2{font-family:'Syne',system-ui;font-size:20px;font-weight:700;color:#FAFAFA;margin:0 0 10px;letter-spacing:-.02em}
        .msg{font-size:13px;color:#71717A;line-height:1.6;margin-bottom:24px;word-break:break-word}
        .pre{background:#18181B;border:1px solid rgba(255,255,255,0.06);border-radius:8px;padding:10px 14px;font-size:11.5px;color:#A1A1AA;text-align:left;margin-bottom:24px;overflow-x:auto;white-space:pre-wrap;word-break:break-word}
        .btn{height:40px;padding:0 20px;border-radius:8px;border:none;background:#C8F135;color:#09090B;font-family:'Syne',system-ui;font-size:13px;font-weight:700;cursor:pointer;transition:background .12s}
        .btn:hover{background:#A8D920}
      `}</style>
      <div className="wrap">
        <div className="box">
          <div className="icon">⚠</div>
          <h2>Что-то пошло не так</h2>
          <p className="msg">Произошла неожиданная ошибка. Попробуйте обновить страницу.</p>
          {error.message && <pre className="pre">{error.message}</pre>}
          <button className="btn" onClick={reset}>Попробовать снова</button>
        </div>
      </div>
    </>
  );
}
