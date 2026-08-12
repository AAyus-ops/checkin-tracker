'use strict';

/* ============ 数据层 ============ */
var STORAGE_KEY = 'plan-checkin.v1';
var state = load();

function defaultState() {
  return { version: 1, background: null, habits: [], records: {} };
}

function load() {
  try {
    var raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState();
    var data = JSON.parse(raw);
    if (!data || typeof data !== 'object' || !Array.isArray(data.habits)) return defaultState();
    return {
      version: 1,
      background: typeof data.background === 'string' ? data.background : null,
      habits: data.habits.map(function (h) {
        return {
          id: String(h.id),
          name: String(h.name || '未命名'),
          createdAt: String(h.createdAt || todayStr()),
          sort: Number(h.sort) || 0
        };
      }),
      records: data.records && typeof data.records === 'object' ? data.records : {}
    };
  } catch (e) {
    return defaultState();
  }
}

function save() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    alert('保存失败：浏览器存储不可用或已满');
  }
}

/* ============ 日期工具 ============ */
function pad(n) { return String(n).padStart(2, '0'); }

function fmtDate(d) {
  return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
}

function todayStr() { return fmtDate(new Date()); }

function parseDate(s) {
  var parts = s.split('-').map(Number);
  return new Date(parts[0], parts[1] - 1, parts[2]);
}

function addDays(d, n) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
}

function diffDays(a, b) {
  return Math.round((b - a) / 86400000);
}

var WEEKDAYS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
function weekdayOf(dateStr) { return WEEKDAYS[parseDate(dateStr).getDay()]; }

function nowTimeStr() {
  var d = new Date();
  return fmtDate(d) + 'T' + pad(d.getHours()) + ':' + pad(d.getMinutes());
}

/* ============ 数据操作 ============ */
function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function keyFor(habitId, dateStr) { return habitId + '|' + dateStr; }

function isChecked(habitId, dateStr) {
  return Object.prototype.hasOwnProperty.call(state.records, keyFor(habitId, dateStr));
}

function checkedTime(habitId, dateStr) {
  return state.records[keyFor(habitId, dateStr)] || null;
}

function sortedHabits() {
  return state.habits.slice().sort(function (a, b) {
    return a.sort - b.sort || a.createdAt.localeCompare(b.createdAt);
  });
}

function addHabit(name) {
  state.habits.push({
    id: uid(),
    name: name.trim(),
    createdAt: todayStr(),
    sort: state.habits.length
  });
  save();
}

function renameHabit(id, name) {
  var h = state.habits.find(function (x) { return x.id === id; });
  if (h) { h.name = name.trim(); save(); }
}

function deleteHabit(id) {
  state.habits = state.habits.filter(function (h) { return h.id !== id; });
  Object.keys(state.records).forEach(function (k) {
    if (k.indexOf(id + '|') === 0) delete state.records[k];
  });
  sortedHabits().forEach(function (h, i) { h.sort = i; });
  save();
}

function moveHabit(id, dir) {
  var list = sortedHabits();
  var idx = list.findIndex(function (h) { return h.id === id; });
  var target = idx + dir;
  if (idx < 0 || target < 0 || target >= list.length) return;
  var tmp = list[idx].sort;
  list[idx].sort = list[target].sort;
  list[target].sort = tmp;
  save();
  renderManage();
}

function toggleCheckin(habitId, dateStr) {
  if (dateStr !== todayStr()) return; // 严格模式：只能打卡/取消今天
  var k = keyFor(habitId, dateStr);
  if (state.records[k]) delete state.records[k];
  else state.records[k] = nowTimeStr();
  save();
}

/* ============ 统计 ============ */
function calcStreak(habit) {
  var today = todayStr();
  var cursor;
  if (isChecked(habit.id, today)) cursor = parseDate(today);
  else cursor = addDays(parseDate(today), -1);
  var count = 0;
  while (true) {
    var ds = fmtDate(cursor);
    if (ds < habit.createdAt) break;
    if (!isChecked(habit.id, ds)) break;
    count++;
    cursor = addDays(cursor, -1);
  }
  return count;
}

function calcRate(habit) {
  var start = parseDate(habit.createdAt);
  var end = parseDate(todayStr());
  var total = diffDays(start, end) + 1;
  if (total <= 0) return 0;
  var checked = 0;
  var d = start;
  while (d <= end) {
    if (isChecked(habit.id, fmtDate(d))) checked++;
    d = addDays(d, 1);
  }
  return Math.round((checked / total) * 100);
}

/* ============ 渲染工具 ============ */
function esc(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/* ============ 背景设置 ============ */
function bgUrl(u) {
  return "url('" + String(u).replace(/'/g, '%27').replace(/"/g, '%22') + "')";
}

function applyBackground() {
  var layer = document.getElementById('bgLayer');
  if (!layer) return;
  layer.style.backgroundImage = state.background ? bgUrl(state.background) : '';
}

function renderBgPreview() {
  var el = document.getElementById('bgPreview');
  if (!el) return;
  if (state.background) {
    el.style.backgroundImage = bgUrl(state.background);
    el.innerHTML = '<span class="bg-preview-tag">已设置背景</span>';
  } else {
    el.style.backgroundImage = '';
    el.innerHTML = '<span class="bg-preview-tag">默认背景</span>';
  }
}

function setBackground(bg) {
  if (bg && String(bg).length > 4500000) {
    alert('图片太大，无法保存，请换一张或使用图片链接');
    return;
  }
  state.background = bg;
  save();
  applyBackground();
  renderBgPreview();
}

function processImage(file, cb) {
  var reader = new FileReader();
  reader.onload = function (e) {
    var img = new Image();
    img.onload = function () {
      var MAX = 1920;
      var w = img.width;
      var h = img.height;
      if (w > MAX || h > MAX) {
        var ratio = Math.min(MAX / w, MAX / h);
        w = Math.round(w * ratio);
        h = Math.round(h * ratio);
      }
      var canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      var ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, w, h);
      cb(canvas.toDataURL('image/jpeg', 0.8));
    };
    img.onerror = function () { alert('图片读取失败，请换一张试试'); };
    img.src = e.target.result;
  };
  reader.onerror = function () { alert('文件读取失败'); };
  reader.readAsDataURL(file);
}

/* ============ 今日视图 ============ */
function renderToday() {
  var habits = sortedHabits();
  var today = todayStr();
  var listEl = document.getElementById('todayList');
  var emptyEl = document.getElementById('emptyToday');
  listEl.innerHTML = '';

  var total = habits.length;
  var done = habits.filter(function (h) { return isChecked(h.id, today); }).length;

  document.getElementById('progressNum').textContent = done + '/' + total;
  document.getElementById('progressBar').style.width = (total ? Math.round(done / total * 100) : 0) + '%';
  var hint = document.getElementById('progressHint');
  if (total === 0) hint.textContent = '去「管理」添加第一个习惯后开始打卡';
  else if (done === total) hint.textContent = '🎉 今天全部完成，太棒了！';
  else if (done === 0) hint.textContent = '今天还没打卡，加油！';
  else hint.textContent = '还剩 ' + (total - done) + ' 项待完成';

  emptyEl.hidden = total > 0;

  habits.forEach(function (h) {
    var checked = isChecked(h.id, today);
    var time = checkedTime(h.id, today);
    var card = document.createElement('div');
    card.className = 'habit-card ' + (checked ? 'done' : 'pending');
    var timeChip = checked && time ? '<span class="chip chip-time">🕐 ' + esc(time.slice(11)) + '</span>' : '';
    card.innerHTML =
      '<div class="habit-info">' +
        '<div class="habit-name">' + esc(h.name) + '</div>' +
        '<div class="habit-meta">' +
          '<span class="chip">🔥 连续 ' + calcStreak(h) + ' 天</span>' +
          '<span class="chip">📊 完成率 ' + calcRate(h) + '%</span>' +
          timeChip +
        '</div>' +
      '</div>' +
      '<button class="check-btn' + (checked ? ' checked' : '') + '" data-id="' + h.id + '">' +
        (checked ? '✓ 已打卡' : '打卡') +
      '</button>';
    listEl.appendChild(card);
  });
}

/* ============ 日历视图 ============ */
var calYear = 0, calMonth = 0, calFilter = 'all';

function initCalendar() {
  var t = parseDate(todayStr());
  calYear = t.getFullYear();
  calMonth = t.getMonth();
}

function dayStatus(dateStr) {
  var today = todayStr();
  if (dateStr > today) return { state: 'future' };
  var habits = sortedHabits().filter(function (h) { return h.createdAt <= dateStr; });
  if (habits.length === 0) return { state: 'none' };
  if (calFilter !== 'all') {
    var h = habits.find(function (x) { return x.id === calFilter; });
    if (!h) return { state: 'none' };
    var done1 = isChecked(h.id, dateStr);
    return { state: done1 ? 'done' : 'miss', done: done1 ? 1 : 0, total: 1 };
  }
  var done = habits.filter(function (h) { return isChecked(h.id, dateStr); }).length;
  var total = habits.length;
  var state = done === total ? 'done' : (done === 0 ? 'miss' : 'part');
  return { state: state, done: done, total: total };
}

function renderCalendar() {
  var sel = document.getElementById('calFilter');
  var habits = sortedHabits();
  sel.innerHTML = '';
  var optAll = document.createElement('option');
  optAll.value = 'all';
  optAll.textContent = '全部习惯';
  sel.appendChild(optAll);
  habits.forEach(function (h) {
    var o = document.createElement('option');
    o.value = h.id;
    o.textContent = h.name;
    sel.appendChild(o);
  });
  sel.value = calFilter;

  document.getElementById('calTitle').textContent = calYear + '年' + (calMonth + 1) + '月';

  var grid = document.getElementById('calGrid');
  grid.innerHTML = '';

  ['一', '二', '三', '四', '五', '六', '日'].forEach(function (w) {
    var el = document.createElement('div');
    el.className = 'cal-cell cal-weekday';
    el.textContent = w;
    grid.appendChild(el);
  });

  var first = new Date(calYear, calMonth, 1);
  var offset = (first.getDay() + 6) % 7;
  var daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
  var today = todayStr();
  var i;

  for (i = 0; i < offset; i++) {
    var blank = document.createElement('div');
    blank.className = 'cal-cell cal-blank';
    grid.appendChild(blank);
  }

  for (i = 1; i <= daysInMonth; i++) {
    var dateStr = calYear + '-' + pad(calMonth + 1) + '-' + pad(i);
    var cell = document.createElement('div');
    cell.className = 'cal-cell';
    var status = dayStatus(dateStr);
    if (status.state === 'done') cell.classList.add('cal-done');
    else if (status.state === 'part') cell.classList.add('cal-part');
    else if (status.state === 'miss') cell.classList.add('cal-miss');
    else cell.classList.add('cal-plain');
    if (dateStr === today) cell.classList.add('cal-today');

    var num = document.createElement('span');
    num.className = 'cal-num';
    num.textContent = i;
    cell.appendChild(num);

    if (status.state !== 'future' && status.state !== 'none') {
      if (calFilter === 'all') {
        var p = document.createElement('span');
        p.className = 'cal-progress';
        p.textContent = status.done + '/' + status.total;
        cell.appendChild(p);
      } else {
        var dot = document.createElement('span');
        dot.className = 'cal-dot ' + (status.done ? 'dot-done' : 'dot-miss');
        cell.appendChild(dot);
      }
    }

    cell.addEventListener('click', function (ds) {
      return function () { openDayDetail(ds); };
    }(dateStr));
    grid.appendChild(cell);
  }
}

function openDayDetail(dateStr) {
  var today = todayStr();
  var habits = sortedHabits().filter(function (h) { return h.createdAt <= dateStr; });
  var d = parseDate(dateStr);
  var title = d.getFullYear() + '年' + (d.getMonth() + 1) + '月' + d.getDate() + '日 ' + weekdayOf(dateStr);
  var body = '';
  if (habits.length === 0) {
    body = '<p class="modal-empty">当天还没有打卡习惯</p>';
  } else {
    habits.forEach(function (h) {
      var checked = isChecked(h.id, dateStr);
      var time = checkedTime(h.id, dateStr);
      var statusText = checked
        ? '✓ 已打卡' + (time ? ' ' + esc(time.slice(11)) : '')
        : (dateStr < today ? '✗ 漏卡' : '未打卡');
      var btn = dateStr === today
        ? '<button class="mini-btn" data-id="' + h.id + '">' + (checked ? '取消' : '打卡') + '</button>'
        : '';
      body += '<div class="day-row ' + (checked ? 'row-done' : 'row-miss') + '">' +
        '<span class="day-name">' + esc(h.name) + '</span>' +
        '<span class="day-status">' + statusText + '</span>' +
        btn +
      '</div>';
    });
  }
  openModal(title, body);
}

/* ============ 管理视图 ============ */
function renderManage() {
  var list = sortedHabits();
  var el = document.getElementById('manageList');
  el.innerHTML = '';
  document.getElementById('emptyManage').hidden = list.length > 0;

  list.forEach(function (h, idx) {
    var row = document.createElement('div');
    row.className = 'manage-row';
    row.innerHTML =
      '<div class="manage-name">' + esc(h.name) + '</div>' +
      '<div class="manage-actions">' +
        '<button class="icon-btn" data-act="up" data-id="' + h.id + '"' + (idx === 0 ? ' disabled' : '') + '>↑</button>' +
        '<button class="icon-btn" data-act="down" data-id="' + h.id + '"' + (idx === list.length - 1 ? ' disabled' : '') + '>↓</button>' +
        '<button class="icon-btn" data-act="edit" data-id="' + h.id + '">✏️</button>' +
        '<button class="icon-btn danger" data-act="del" data-id="' + h.id + '">🗑️</button>' +
      '</div>';
    el.appendChild(row);
  });
  renderBgPreview();
}

function openRename(id) {
  var h = state.habits.find(function (x) { return x.id === id; });
  if (!h) return;
  openModal('重命名习惯',
    '<form id="renameForm" class="modal-form">' +
      '<input id="renameInput" class="text-input" type="text" maxlength="20" value="' + esc(h.name) + '" autocomplete="off">' +
      '<button type="submit" class="btn btn-primary btn-block">保存</button>' +
    '</form>'
  );
  var input = document.getElementById('renameInput');
  input.focus();
  input.select();
  document.getElementById('renameForm').addEventListener('submit', function (e) {
    e.preventDefault();
    var name = input.value.trim();
    if (!name) return;
    renameHabit(id, name);
    closeModal();
    renderManage();
  });
}

/* ============ 弹窗 ============ */
function openModal(title, bodyHTML) {
  document.getElementById('modalTitle').textContent = title;
  document.getElementById('modalBody').innerHTML = bodyHTML;
  document.getElementById('modalOverlay').hidden = false;
}

function closeModal() {
  document.getElementById('modalOverlay').hidden = true;
  document.getElementById('modalBody').innerHTML = '';
}

/* ============ 视图切换 ============ */
function switchView(name) {
  ['today', 'calendar', 'manage'].forEach(function (v) {
    document.getElementById('view-' + v).hidden = (v !== name);
  });
  document.querySelectorAll('.tab').forEach(function (t) {
    t.classList.toggle('active', t.dataset.view === name);
  });
  if (name === 'today') renderToday();
  else if (name === 'calendar') renderCalendar();
  else if (name === 'manage') renderManage();
}

/* ============ 事件绑定 ============ */
document.addEventListener('DOMContentLoaded', function () {
  initCalendar();
  applyBackground();

  var d = parseDate(todayStr());
  document.getElementById('todayLine').textContent =
    d.getFullYear() + '年' + (d.getMonth() + 1) + '月' + d.getDate() + '日 ' + weekdayOf(todayStr());

  document.querySelectorAll('.tab').forEach(function (t) {
    t.addEventListener('click', function () { switchView(t.dataset.view); });
  });

  document.getElementById('todayList').addEventListener('click', function (e) {
    var btn = e.target.closest('.check-btn');
    if (!btn) return;
    toggleCheckin(btn.dataset.id, todayStr());
    renderToday();
  });

  document.getElementById('addForm').addEventListener('submit', function (e) {
    e.preventDefault();
    var input = document.getElementById('newHabitName');
    var name = input.value.trim();
    if (!name) { input.focus(); return; }
    addHabit(name);
    input.value = '';
    renderManage();
  });

  document.getElementById('calPrev').addEventListener('click', function () {
    calMonth--;
    if (calMonth < 0) { calMonth = 11; calYear--; }
    renderCalendar();
  });
  document.getElementById('calNext').addEventListener('click', function () {
    calMonth++;
    if (calMonth > 11) { calMonth = 0; calYear++; }
    renderCalendar();
  });
  document.getElementById('calFilter').addEventListener('change', function (e) {
    calFilter = e.target.value;
    renderCalendar();
  });

  document.getElementById('manageList').addEventListener('click', function (e) {
    var btn = e.target.closest('button[data-act]');
    if (!btn) return;
    var act = btn.dataset.act;
    var id = btn.dataset.id;
    if (act === 'up') moveHabit(id, -1);
    else if (act === 'down') moveHabit(id, 1);
    else if (act === 'edit') openRename(id);
    else if (act === 'del') {
      var h = state.habits.find(function (x) { return x.id === id; });
      if (h && confirm('确定删除习惯「' + h.name + '」吗？其打卡记录也会一并删除。')) {
        deleteHabit(id);
        if (calFilter === id) calFilter = 'all';
        renderManage();
      }
    }
  });

  document.getElementById('bgUploadBtn').addEventListener('click', function () {
    document.getElementById('bgFileInput').click();
  });
  document.getElementById('bgFileInput').addEventListener('change', function (e) {
    var file = e.target.files && e.target.files[0];
    if (!file) return;
    processImage(file, function (dataUrl) {
      setBackground(dataUrl);
      document.getElementById('bgFileInput').value = '';
      alert('背景已更新 ✅');
    });
  });
  document.getElementById('bgApplyBtn').addEventListener('click', function () {
    var input = document.getElementById('bgUrlInput');
    var url = input.value.trim();
    if (!url) return;
    if (!/^https?:\/\/.+/i.test(url)) {
      alert('请输入以 http:// 或 https:// 开头的图片链接');
      return;
    }
    setBackground(url);
    input.value = '';
    alert('背景已更新 ✅');
  });
  document.getElementById('bgResetBtn').addEventListener('click', function () {
    if (confirm('确定恢复默认背景吗？')) {
      setBackground(null);
    }
  });

  document.getElementById('modalClose').addEventListener('click', closeModal);
  document.getElementById('modalOverlay').addEventListener('click', function (e) {
    if (e.target === document.getElementById('modalOverlay')) closeModal();
  });
  document.getElementById('modalBody').addEventListener('click', function (e) {
    var btn = e.target.closest('.mini-btn');
    if (!btn) return;
    toggleCheckin(btn.dataset.id, todayStr());
    openDayDetail(todayStr());
    renderToday();
  });

  switchView('today');
});
