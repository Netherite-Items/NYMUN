(() => {
  'use strict';

  /* ============================================================
   * 表单后端配置（EmailJS）
   * ------------------------------------------------------------
   * 需要填 4 个值：
   *   前三个 = EmailJS 后台拿到的 ID（决定「用谁发信」）
   *   TO_EMAIL = 你的收件邮箱（决定「发到哪」），改成 163 地址即可
   *
   * 未填写前表单不会报错，自动退回「本机留档 + mailto 兜底」。
   * ============================================================ */
  const EMAILJS = {
    PUBLIC_KEY: '7zG1kNQ-B389VQpcL',  // EmailJS → Account → API Keys → Public Key
    SERVICE_ID: 'service_8bz83r4',    // EmailJS → Email Services → Service ID
    TEMPLATE_ID: 'template_lsydouq',   // EmailJS → Email Templates
    TO_EMAIL: 'husiyuan0705@163.com'  // 收件邮箱
  };
  const EMAILJS_ENABLED =
    EMAILJS.PUBLIC_KEY !== 'YOUR_PUBLIC_KEY' &&
    EMAILJS.SERVICE_ID !== 'YOUR_SERVICE_ID' &&
    EMAILJS.TEMPLATE_ID !== 'YOUR_TEMPLATE_ID';

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

  /* ============================================================
   * 表单：校验 → 发送到邮箱（EmailJS）→ 本地留档兜底
   * ============================================================ */
  document.querySelectorAll('form[data-local-form]').forEach((form) => {
    const alertBox = form.querySelector('.alert');
    const submitBtn = form.querySelector('button[type="submit"]');
    const storeKey = form.dataset.store || 'nymun_form';
    const formTitle = form.dataset.formTitle || '网站表单提交';

    const show = (type, title, body) => {
      alertBox.className = `alert alert--${type} is-show`;
      alertBox.innerHTML = `<span aria-hidden="true" style="font-size:18px;line-height:1">${type === 'ok' ? '\u2713' : '!'}</span>
        <span><strong style="display:block;color:inherit;margin-bottom:2px">${title}</strong>${body}</span>`;
      alertBox.focus();
    };

    // 读取字段名 → 中文标签
    const labelOf = (field) => {
      const lab = form.querySelector(`label[for="${field.name}"]`);
      if (lab) return lab.textContent.replace(/\*/g, '').trim();
      const wrap = field.closest('.check');
      if (wrap) return wrap.textContent.replace(/\*/g, '').trim();
      return field.name;
    };

    // 组装「人名 + 值」的可读文本，用于邮件正文
    const buildSummary = (data, fields) => {
      return fields
        .map((f) => {
          const raw = data.get(f.name);
          let v;
          if (f.type === 'checkbox') v = f.checked ? '已确认' : '未确认';
          else if (f.tagName === 'SELECT') v = (f.options[f.selectedIndex] || {}).text || '';
          else v = raw == null ? '' : String(raw);
          return `${labelOf(f)}：${v.trim() || '（未填写）'}`;
        })
        .join('\n');
    };

    // 组装 CSV 行，便于直接粘进表格
    const buildCsv = (data, fields) => {
      const cell = (s) => `"${String(s == null ? '' : s).replace(/"/g, '""').replace(/\r?\n/g, ' ')}"`;
      const ts = new Date().toLocaleString('zh-CN', { hour12: false });
      const vals = fields.map((f) => {
        if (f.type === 'checkbox') return f.checked ? '已确认' : '未确认';
        if (f.tagName === 'SELECT') return (f.options[f.selectedIndex] || {}).text || '';
        return data.get(f.name) == null ? '' : String(data.get(f.name));
      });
      return [cell(ts), ...vals.map(cell)].join(',');
    };

    // 本地留档兜底（邮件发送失败时不丢数据）
    const saveLocal = (obj) => {
      try {
        const list = JSON.parse(localStorage.getItem(storeKey) || '[]');
        list.push({ time: new Date().toISOString(), ...obj });
        localStorage.setItem(storeKey, JSON.stringify(list));
      } catch (_) {
        /* 隐私模式下 localStorage 可能不可用，忽略 */
      }
    };

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const data = new FormData(form);
      const required = form.querySelectorAll('[required]');
      const fields = Array.from(form.querySelectorAll('input, select, textarea'));
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

      const summary = buildSummary(data, fields);
      const csv = buildCsv(data, fields);
      const payload = Object.fromEntries(data.entries());
      submitBtn.disabled = true;
      const originalText = submitBtn.textContent;
      submitBtn.textContent = '正在提交…';

      // 未配置 EmailJS：仅本地留档，并给出 mailto 兜底
      if (!EMAILJS_ENABLED) {
        saveLocal(payload);
        submitBtn.textContent = '提交成功 \u2713';
        show('ok', form.dataset.okTitle || '提交成功',
          (form.dataset.okBody || '我们已收到你的提交。') +
          `<br><span style="opacity:.75">（提示：网站邮件服务尚未配置，内容已保存在本机。你也可以直接发邮件给我们。）</span>`);
        form.querySelectorAll('input, select, textarea').forEach((f) => (f.disabled = true));
        return;
      }

      try {
        const res = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            service_id: EMAILJS.SERVICE_ID,
            template_id: EMAILJS.TEMPLATE_ID,
            user_id: EMAILJS.PUBLIC_KEY,
            template_params: {
              to_email: EMAILJS.TO_EMAIL,
              form_title: formTitle,
              subject: `[南洋模联] ${formTitle}`,
              message: summary,
              csv_row: csv,
              submit_time: new Date().toLocaleString('zh-CN', { hour12: false })
            }
          })
        });

        if (!res.ok) throw new Error('HTTP ' + res.status);
        saveLocal(payload);
        submitBtn.textContent = '提交成功 \u2713';
        show('ok', form.dataset.okTitle || '提交成功', form.dataset.okBody || '我们已收到你的提交。');
        form.querySelectorAll('input, select, textarea').forEach((f) => (f.disabled = true));
      } catch (err) {
        saveLocal(payload);
        submitBtn.disabled = false;
        submitBtn.textContent = originalText;
        const mailto = `mailto:${EMAILJS.TO_EMAIL}?subject=${encodeURIComponent('[南洋模联] ' + formTitle)}&body=${encodeURIComponent(summary)}`;
        show('err', '提交没能发出去',
          `内容已保存在本机，不会丢失。可能是网络问题，请稍后再试，或直接<a href="${mailto}" style="color:inherit;text-decoration:underline">发邮件给我们</a>。`);
      }
    });
  });

  /* ============================================================
   * 相册灯箱：点击照片时放大预览
   * ============================================================ */
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
})();
