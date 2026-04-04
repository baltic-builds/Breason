export default function Loading() {
  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@700&display=swap');
        body{margin:0;background:#09090B}
        .wrap{min-height:100vh;display:flex;align-items:center;justify-content:center}
        .box{display:flex;flex-direction:column;align-items:center;gap:14px}
        .mark{width:36px;height:36px;border-radius:10px;background:#C8F135;color:#09090B;font-family:'Syne',system-ui;font-weight:800;font-size:16px;display:grid;place-items:center;animation:breathe 1.6s ease-in-out infinite}
        .label{font-family:'Syne',system-ui;font-size:13px;font-weight:600;color:#52525B;letter-spacing:.04em}
        @keyframes breathe{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.6;transform:scale(.93)}}
      `}</style>
      <div className="wrap">
        <div className="box">
          <div className="mark">B</div>
          <div className="label">Загружаем Breason…</div>
        </div>
      </div>
    </>
  );
}
