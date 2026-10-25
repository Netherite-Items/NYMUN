(() => {
  'use strict';

  const header = document.querySelector('.site-header');
  const toggle = document.querySelector('.nav-toggle');
  const navLinks = document.querySelector('.nav-links');
  const links = document.querySelectorAll('.nav-links a');

  // 导航滚动态
  const onScroll = () => {
    if (!header) return;
    header.classList.toggle('is-scrolled', window.scrollY > 12);
  };
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });

  // 移动端菜单
  if (toggle && navLinks) {
    toggle.addEventListener('click', () => {
      navLinks.classList.toggle('is-open');
    });
    navLinks.addEventListener('click', (e) => {
      if (e.target.tagName === 'A') navLinks.classList.remove('is-open');
    });
  }

  // 当前页高亮
  const path = location.pathname.replace(/\/+$/, '') || '/';
  links.forEach((a) => {
    const href = a.getAttribute('href');
    if (!href) return;
    const page = href.replace(/\/+$/, '') || '/';
    if (page === path || (page !== '/' && path.endsWith(page))) {
      a.classList.add('is-active');
      a.setAttribute('aria-current', 'page');
    }
  });

  // 页内锚点平滑滚动（不覆盖浏览器默认键盘行为）
  document.querySelectorAll('a[data-scroll]').forEach((a) => {
    a.addEventListener('click', (e) => {
      const id = a.getAttribute('href');
      if (!id || id === '#') return;
      const target = document.querySelector(id);
      if (!target) return;
      e.preventDefault();
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });

  // 滚动揭示
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((en) => {
          if (en.isIntersecting) {
            en.target.classList.add('is-in');
            io.unobserve(en.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: '0px 0px -40px' }
    );
    document.querySelectorAll('.reveal').forEach((el) => io.observe(el));
  } else {
    document.querySelectorAll('.reveal').forEach((el) => el.classList.add('is-in'));
  }

  // 数字递增动画
  if ('IntersectionObserver' in window) {
    const numIo = new IntersectionObserver(
      (entries) => {
        entries.forEach((en) => {
          if (!en.isIntersecting) return;
          const el = en.target;
          const target = parseFloat(el.dataset.count);
          const decimals = (el.dataset.count.split('.')[1] || '').length;
          const suffix = el.dataset.suffix || '';
          const duration = 1500;
          const start = performance.now();
          const step = (now) => {
            const p = Math.min(1, (now - start) / duration);
            const eased = 1 - Math.pow(1 - p, 3);
            el.textContent = (target * eased).toFixed(decimals) + suffix;
            if (p < 1) requestAnimationFrame(step);
            else el.textContent = target.toFixed(decimals) + suffix;
          };
          requestAnimationFrame(step);
          numIo.unobserve(el);
        });
      },
      { threshold: 0.6 }
    );
    document.querySelectorAll('[data-count]').forEach((el) => numIo.observe(el));
  }

  // 本地留档表单（报名 / 章程意见等）：仅做校验 + 浏览器本地留档，不发送数据
  document.querySelectorAll('form[data-local-form]').forEach((form) => {
    const alertBox = form.querySelector('.alert');
    const submitBtn = form.querySelector('button[type="submit"]');
    const storeKey = form.dataset.store || 'nymun_form';

    const show = (type, title, body) => {
      alertBox.className = `alert alert--${type} is-show`;
      alertBox.innerHTML = `<span aria-hidden="true" style="font-size:18px;line-height:1">${type === 'ok' ? '\u2713' : '!'}</span>
        <span><strong style="display:block;color:inherit;margin-bottom:2px">${title}</strong>${body}</span>`;
      alertBox.focus();
    };

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const data = new FormData(form);
      const required = form.querySelectorAll('[required]');
      let firstInvalid = null;

      required.forEach((f) => {
        const value = data.get(f.name) || '';
        const valid = f.matches('input[type="checkbox"]') ? f.checked : String(value).trim().length > 0;
        f.style.borderColor = valid ? '' : 'rgba(235,84,84,0.6)';
        if (!valid && !firstInvalid) firstInvalid = f;
      });

      if (firstInvalid) {
        show('err', '还有内容没填完', '请补全标红的必填项后再次提交。');
        firstInvalid.focus();
        return;
      }

      try {
        const record = Object.fromEntries(data.entries());
        const list = JSON.parse(localStorage.getItem(storeKey) || '[]');
        list.push({ time: new Date().toISOString(), ...record });
        localStorage.setItem(storeKey, JSON.stringify(list));
      } catch (_) {
        /* 忽略：隐私模式下可能不可用 */
      }

      submitBtn.disabled = true;
      submitBtn.textContent = '提交成功 \u2713';
      show('ok', form.dataset.okTitle || '提交成功', form.dataset.okBody || '我们已收到你的提交。');
      form.querySelectorAll('input, select, textarea').forEach((f) => (f.disabled = true));
    });
  });
})();

  // 相册灯箱：点击「瞬间」占位图或真实照片时放大预览
  const lightbox = document.querySelector('.lightbox');
  if (lightbox) {
    const inner = lightbox.querySelector('.lightbox-inner');
    const cap = lightbox.querySelector('.lightbox-cap');
    const close = () => lightbox.classList.remove('is-open');

    document.querySelectorAll('.moment').forEach((fig) => {
      fig.style.cursor = 'zoom-in';
      fig.addEventListener('click', () => {
        const ph = fig.querySelector('.moment-ph');
        const caption = fig.querySelector('.moment-cap span');
        const time = fig.querySelector('.moment-cap time');
        inner.innerHTML = `<div class="moment-ph">${ph.innerHTML}</div>`;
        cap.textContent = `${caption ? caption.textContent : ''}${time ? ' · ' + time.textContent : ''}`;
        lightbox.classList.add('is-open');
      });
    });

    const closeBtn = lightbox.querySelector('.lightbox-close');
    if (closeBtn) closeBtn.addEventListener('click', close);
    lightbox.addEventListener('click', (e) => {
      if (e.target === lightbox) close();
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') close();
    });
  }
