document.querySelector('[data-back]').addEventListener('click', function () {
  // 다른 사이트나 없는 이전 기록으로 돌아가는 대신 홈으로 안내한다.
  let sameOrigin = false;
  try { sameOrigin = new URL(document.referrer).origin === location.origin; } catch (_) {}
  if (sameOrigin && history.length > 1) history.back();
  else location.assign(new URL('index.html#home', document.baseURI).href);
});
