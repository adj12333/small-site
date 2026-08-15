// 与 DeepSeek 聊天：前端只调本地 /api/chat，Key 由后端代理（server/proxy.py）持有
// 增加人机验证：先通过 /api/verify 拿到一次性会话 token，聊天请求必须携带该 token
(function () {
  var messagesEl = document.getElementById('chat-messages');
  var inputEl = document.getElementById('chat-input');
  var sendBtn = document.getElementById('chat-send');

  var overlayEl = document.getElementById('captcha-overlay');
  var questionEl = document.getElementById('captcha-question');
  var answerEl = document.getElementById('captcha-answer');
  var submitEl = document.getElementById('captcha-submit');
  var errorEl = document.getElementById('captcha-error');

  var history = [];
  var chatToken = null;
  var captchaId = null;

  function addMessage(role, content) {
    var div = document.createElement('div');
    div.className = 'chat-msg chat-msg-' + role;
    div.textContent = content;
    messagesEl.appendChild(div);
    messagesEl.scrollTop = messagesEl.scrollHeight;
    return div;
  }

  function setBusy(busy) {
    sendBtn.disabled = busy;
    inputEl.disabled = busy;
  }

  function showCaptcha() {
    captchaId = null;
    questionEl.textContent = '加载中…';
    answerEl.value = '';
    errorEl.textContent = '';
    overlayEl.style.display = 'flex';

    fetch('/api/captcha')
      .then(function (resp) { return resp.json(); })
      .then(function (data) {
        captchaId = data.id;
        questionEl.textContent = data.question;
        answerEl.focus();
      })
      .catch(function () {
        questionEl.textContent = '验证码加载失败';
      });
  }

  function submitCaptcha() {
    var answer = answerEl.value.trim();
    if (!answer || !captchaId) return;

    submitEl.disabled = true;
    fetch('/api/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: captchaId, answer: answer })
    })
      .then(function (resp) {
        return resp.json().then(function (data) {
          if (!resp.ok) {
            throw new Error(data && data.error && data.error.message);
          }
          return data;
        });
      })
      .then(function (data) {
        chatToken = data.token;
        overlayEl.style.display = 'none';
        submitEl.disabled = false;
        inputEl.focus();
      })
      .catch(function (err) {
        errorEl.textContent = err.message || '验证失败，请重试';
        submitEl.disabled = false;
        showCaptcha();
      });
  }

  function send() {
    var text = inputEl.value.trim();
    if (!text || sendBtn.disabled) return;

    if (!chatToken) {
      showCaptcha();
      return;
    }

    inputEl.value = '';
    addMessage('user', text);
    history.push({ role: 'user', content: text });

    setBusy(true);
    var pending = addMessage('assistant', '思考中…');

    fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: chatToken, messages: history.slice() })
    })
      .then(function (resp) {
        if (resp.status === 401) {
          chatToken = null;
          showCaptcha();
          return resp.json().then(function (data) {
            throw new Error((data && data.error && data.error.message) || '请先完成人机验证');
          });
        }
        if (!resp.ok) {
          return resp.json().then(function (data) {
            var msg = data && data.error && data.error.message;
            throw new Error(msg || ('请求失败（HTTP ' + resp.status + '）'));
          });
        }
        return streamReply(resp, pending);
      })
      .catch(function (err) {
        pending.textContent = '出错了：' + err.message;
      })
      .then(function () {
        setBusy(false);
        inputEl.focus();
      });
  }

  function streamReply(resp, pendingEl) {
    var reader = resp.body.getReader();
    var decoder = new TextDecoder();
    var buffer = '';
    var reply = '';
    pendingEl.textContent = '';

    function pump() {
      return reader.read().then(function (result) {
        if (result.done) {
          if (!reply) pendingEl.textContent = '（无回复）';
          history.push({ role: 'assistant', content: reply });
          return;
        }
        buffer += decoder.decode(result.value, { stream: true });
        var lines = buffer.split('\n');
        buffer = lines.pop();
        lines.forEach(function (line) {
          var text = line.trim();
          if (text.indexOf('data:') !== 0) return;
          var payload = text.slice(5).trim();
          if (payload === '[DONE]') return;
          try {
            var obj = JSON.parse(payload);
            var delta = obj.choices && obj.choices[0] && obj.choices[0].delta;
            var content = delta && delta.content;
            if (content) {
              reply += content;
              pendingEl.textContent = reply;
              messagesEl.scrollTop = messagesEl.scrollHeight;
            }
          } catch (e) {}
        });
        return pump();
      });
    }

    return pump();
  }

  sendBtn.addEventListener('click', send);
  inputEl.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  });

  submitEl.addEventListener('click', submitCaptcha);
  answerEl.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      submitCaptcha();
    }
  });

  addMessage('assistant', '你好，我是 DeepSeek，有什么可以帮你？');
  showCaptcha();
})();
