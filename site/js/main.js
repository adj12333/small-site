// 移动端检测：仅根据视口宽度判断，尊重浏览器「请求桌面端/移动端网站」切换
// 用户请求桌面端网站时，浏览器会报告更大的视口宽度，自动退回桌面端样式
(function () {
  var MOBILE_BREAKPOINT = 768;
  var root = document.documentElement;

  function updateMobile() {
    if (window.innerWidth < MOBILE_BREAKPOINT) {
      root.setAttribute('data-mobile', '');
    } else {
      root.removeAttribute('data-mobile');
    }
  }

  // 触屏检测（独立于移动端/桌面端模式，触屏笔记本也会移除点击高亮）
  var isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  if (isTouch) root.setAttribute('data-touch', '');

  updateMobile();
  window.addEventListener('resize', updateMobile);
})();

// 导航高亮：根据当前页面给对应导航项加 active 类（可选，缺失不影响使用）
(function () {
  var links = document.querySelectorAll('.site-nav a');
  var path = window.location.pathname;
  var current = path.split('/').pop() || 'index.html';

  links.forEach(function (link) {
    var href = link.getAttribute('href');
    if (!href) return;
    var target = href.split('/').pop();
    if (target === current) {
      link.classList.add('active');
    }
  });
})();

// 页脚署名：固定左下角
(function () {
  var footer = document.createElement('footer');
  footer.className = 'site-footer';
  var p = document.createElement('p');
  p.className = 'powered';
  p.textContent = 'power by trae';
  footer.appendChild(p);
  document.body.appendChild(footer);
})();

// 日/夜间模式切换：右下角注入按钮，点击后交叉淡入淡出（旧主题渐隐、新主题渐显）
(function () {
  var toggle = document.createElement('button');
  toggle.type = 'button';
  toggle.className = 'theme-toggle';
  toggle.setAttribute('aria-label', '切换日夜间模式');

  toggle.innerHTML =
    '<svg class="theme-icon theme-icon-sun" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<circle cx="12" cy="12" r="4"></circle>' +
    '<path d="M12 2v2"></path>' +
    '<path d="M12 20v2"></path>' +
    '<path d="M4.93 4.93l1.41 1.41"></path>' +
    '<path d="M17.66 17.66l1.41 1.41"></path>' +
    '<path d="M2 12h2"></path>' +
    '<path d="M20 12h2"></path>' +
    '<path d="M6.34 17.66l-1.41 1.41"></path>' +
    '<path d="M19.07 4.93l-1.41 1.41"></path>' +
    '</svg>' +
    '<svg class="theme-icon theme-icon-moon" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>' +
    '</svg>';

  document.body.appendChild(toggle);

  function applyTheme(next) {
    var root = document.documentElement;
    if (next === 'dark') {
      root.setAttribute('data-theme', 'dark');
    } else {
      root.removeAttribute('data-theme');
    }
    try {
      localStorage.setItem('theme', next);
    } catch (e) {
      // 隐私模式下 localStorage 可能不可用，忽略即可
    }
  }

  toggle.addEventListener('click', function () {
    var root = document.documentElement;
    var next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';

    // 支持 View Transitions 的浏览器用交叉淡入淡出，否则直接切换
    if (document.startViewTransition) {
      document.startViewTransition(function () {
        applyTheme(next);
      });
    } else {
      applyTheme(next);
    }
  });
})();
