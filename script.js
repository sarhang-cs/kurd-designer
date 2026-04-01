const canvas = document.getElementById("editorCanvas");
const ctx = canvas.getContext("2d");
const stage = document.getElementById("stage");

const colorPicker = document.getElementById("colorPicker");
const brushSize = document.getElementById("brushSize");
const brightness = document.getElementById("brightness");
const contrast = document.getElementById("contrast");
const blurRange = document.getElementById("blur");

const historyCount = document.getElementById("historyCount");
const activeToolLabel = document.getElementById("activeToolLabel");
const zoomLabel = document.getElementById("zoomLabel");
const textHint = document.getElementById("textHint");

let currentTool = "brush";
let drawing = false;
let startX = 0;
let startY = 0;
let snapshot = null;
let zoom = 1;
let currentFilter = "none";

const history = [];
let historyIndex = -1;

let isPanning = false;
let panStartX = 0;
let panStartY = 0;
let scrollLeftStart = 0;
let scrollTopStart = 0;

/* ---------- helpers ---------- */

function showToast(message, type = "info") {
  const toast = document.createElement("div");
  toast.textContent = message;

  const backgrounds = {
    info: "linear-gradient(135deg,#7c3aed,#2563eb)",
    success: "linear-gradient(135deg,#16a34a,#22c55e)",
    error: "linear-gradient(135deg,#dc2626,#ef4444)",
  };

  Object.assign(toast.style, {
    position: "fixed",
    left: "14px",
    bottom: "90px",
    zIndex: "9999",
    padding: "12px 14px",
    borderRadius: "14px",
    color: "#fff",
    fontWeight: "700",
    fontSize: "14px",
    background: backgrounds[type] || backgrounds.info,
    boxShadow: "0 14px 30px rgba(0,0,0,.28)",
    opacity: "0",
    transform: "translateY(10px)",
    transition: "all .22s ease",
  });

  document.body.appendChild(toast);

  requestAnimationFrame(() => {
    toast.style.opacity = "1";
    toast.style.transform = "translateY(0)";
  });

  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateY(10px)";
    setTimeout(() => toast.remove(), 250);
  }, 1800);
}

function createSliderValue(input, suffix = "") {
  const value = document.createElement("span");
  value.className = "range-value";
  value.textContent = `${input.value}${suffix}`;
  input.insertAdjacentElement("afterend", value);

  input.addEventListener("input", () => {
    value.textContent = `${input.value}${suffix}`;
  });
}

function setActiveButton(selector, activeElement) {
  document.querySelectorAll(selector).forEach((item) => {
    item.classList.remove("active");
  });
  activeElement.classList.add("active");
}

function saveState() {
  if (historyIndex < history.length - 1) {
    history.splice(historyIndex + 1);
  }

  history.push(canvas.toDataURL("image/png"));
  historyIndex = history.length - 1;
  historyCount.textContent = String(history.length);
}

function restoreState(index) {
  const img = new Image();
  img.onload = () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.filter = "none";
    ctx.globalCompositeOperation = "source-over";
    ctx.drawImage(img, 0, 0);
  };
  img.src = history[index];
}

function undo() {
  if (historyIndex > 0) {
    historyIndex -= 1;
    restoreState(historyIndex);
    showToast("گەڕانەوە کرا");
  }
}

function redo() {
  if (historyIndex < history.length - 1) {
    historyIndex += 1;
    restoreState(historyIndex);
    showToast("دووبارەکردنەوە کرا");
  }
}

function initializeCanvas() {
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  saveState();
}

function getPointerPosition(event) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: (event.clientX - rect.left) * (canvas.width / rect.width),
    y: (event.clientY - rect.top) * (canvas.height / rect.height),
  };
}

function setTool(tool) {
  currentTool = tool;

  document.querySelectorAll(".tool-btn[data-tool]").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.tool === tool);
  });

  const labels = {
    brush: "پەڕە",
    eraser: "سڕینەوە",
    line: "هێڵ",
    rect: "چوارگۆشە",
    circle: "بازنە",
    text: "نووسین",
    pan: "گواستنەوە",
  };

  activeToolLabel.textContent = labels[tool] || "ئامراز";
  textHint.classList.toggle("hidden", tool !== "text");
  stage.style.cursor = tool === "pan" ? "grab" : "crosshair";
}

function applyContextStyle() {
  ctx.strokeStyle = colorPicker.value;
  ctx.fillStyle = colorPicker.value;
  ctx.lineWidth = Number(brushSize.value);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  ctx.filter = [
    currentFilter,
    `brightness(${brightness.value}%)`,
    `contrast(${contrast.value}%)`,
    `blur(${blurRange.value}px)`
  ].join(" ");
}

function redrawSnapshot() {
  if (!snapshot) return;
  ctx.putImageData(snapshot, 0, 0);
}

function drawShape(tool, x1, y1, x2, y2) {
  redrawSnapshot();
  applyContextStyle();

  if (tool === "line") {
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
    return;
  }

  if (tool === "rect") {
    ctx.strokeRect(x1, y1, x2 - x1, y2 - y1);
    return;
  }

  if (tool === "circle") {
    const radius = Math.hypot(x2 - x1, y2 - y1);
    ctx.beginPath();
    ctx.arc(x1, y1, radius, 0, Math.PI * 2);
    ctx.stroke();
  }
}

/* ---------- pointer drawing ---------- */

function startDrawing(event) {
  if (currentTool === "pan") return;

  event.preventDefault();
  const { x, y } = getPointerPosition(event);

  startX = x;
  startY = y;
  drawing = true;
  snapshot = ctx.getImageData(0, 0, canvas.width, canvas.height);

  if (currentTool === "brush" || currentTool === "eraser") {
    applyContextStyle();
    ctx.beginPath();
    ctx.moveTo(x, y);
  }

  if (currentTool === "text") {
    const text = window.prompt("نووسینەکەت بنووسە:");
    if (text && text.trim()) {
      applyContextStyle();
      ctx.font = `${Math.max(18, Number(brushSize.value) * 4)}px Noto Sans Arabic`;
      ctx.fillText(text.trim(), x, y);
      saveState();
      showToast("نووسین زیاد کرا", "success");
    }
    drawing = false;
  }
}

function moveDrawing(event) {
  if (!drawing) return;
  event.preventDefault();

  const { x, y } = getPointerPosition(event);

  if (currentTool === "brush") {
    applyContextStyle();
    ctx.globalCompositeOperation = "source-over";
    ctx.lineTo(x, y);
    ctx.stroke();
    return;
  }

  if (currentTool === "eraser") {
    ctx.globalCompositeOperation = "destination-out";
    ctx.lineWidth = Number(brushSize.value);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.lineTo(x, y);
    ctx.stroke();
    return;
  }

  ctx.globalCompositeOperation = "source-over";

  if (["line", "rect", "circle"].includes(currentTool)) {
    drawShape(currentTool, startX, startY, x, y);
  }
}

function endDrawing() {
  if (!drawing) return;
  drawing = false;
  ctx.globalCompositeOperation = "source-over";
  ctx.filter = "none";
  saveState();
}

canvas.addEventListener("pointerdown", startDrawing);
canvas.addEventListener("pointermove", moveDrawing);
window.addEventListener("pointerup", endDrawing);
window.addEventListener("pointercancel", endDrawing);

/* ---------- tools ---------- */

document.querySelectorAll(".tool-btn[data-tool]").forEach((btn) => {
  btn.addEventListener("click", () => setTool(btn.dataset.tool));
});

document.getElementById("clearCanvas").addEventListener("click", () => {
  if (!window.confirm("دڵنیایت کە بومەکە پاک دەکەیتەوە؟")) return;

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  saveState();
  showToast("بومەکە پاک کرایەوە", "success");
});

document.getElementById("undoBtn").addEventListener("click", undo);
document.getElementById("redoBtn").addEventListener("click", redo);

/* ---------- filters ---------- */

document.querySelectorAll(".filter-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    currentFilter = btn.dataset.filter;
    setActiveButton(".filter-btn", btn);
    showToast("فلتەر گۆڕدرا");
  });
});

[brightness, contrast, blurRange, colorPicker, brushSize].forEach((input) => {
  input.addEventListener("input", () => {
    if (currentTool === "brush" || currentTool === "eraser") {
      applyContextStyle();
    }
  });
});

/* ---------- projects ---------- */

document.getElementById("newProject").addEventListener("click", () => {
  if (!window.confirm("پرۆژەی نوێ دروست بکرێت؟")) return;

  ctx.filter = "none";
  ctx.globalCompositeOperation = "source-over";
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  saveState();
  showToast("پرۆژەی نوێ دروست کرا", "success");
});

document.getElementById("imageLoader").addEventListener("change", (event) => {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (readerEvent) => {
    const img = new Image();
    img.onload = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const scale = Math.min(canvas.width / img.width, canvas.height / img.height);
      const width = img.width * scale;
      const height = img.height * scale;
      const x = (canvas.width - width) / 2;
      const y = (canvas.height - height) / 2;

      ctx.filter = "none";
      ctx.drawImage(img, x, y, width, height);
      saveState();
      showToast("وێنەکە بارکرا", "success");
    };
    img.src = readerEvent.target.result;
  };

  reader.readAsDataURL(file);
  event.target.value = "";
});

function downloadImage(type) {
  const link = document.createElement("a");
  link.download = `kurd-designer.${type === "image/png" ? "png" : "jpg"}`;
  link.href = canvas.toDataURL(type, 0.95);
  link.click();
  showToast(`وێنەکە وەک ${type === "image/png" ? "PNG" : "JPG"} دابەزێنرا`, "success");
}

document.getElementById("downloadPng").addEventListener("click", () => downloadImage("image/png"));
document.getElementById("downloadJpg").addEventListener("click", () => downloadImage("image/jpeg"));

document.getElementById("saveProject").addEventListener("click", () => {
  const payload = {
    version: 1,
    app: "Kurd Designer",
    canvasWidth: canvas.width,
    canvasHeight: canvas.height,
    snapshot: canvas.toDataURL("image/png"),
    savedAt: new Date().toISOString(),
  };

  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const link = document.createElement("a");
  link.download = "kurd-designer-project.json";
  link.href = URL.createObjectURL(blob);
  link.click();

  showToast("پرۆژەکە پاشەکەوت کرا", "success");
});

document.getElementById("projectLoader").addEventListener("change", (event) => {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (readerEvent) => {
    try {
      const payload = JSON.parse(readerEvent.target.result);
      const img = new Image();

      img.onload = () => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.filter = "none";
        ctx.globalCompositeOperation = "source-over";
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        saveState();
        showToast("پرۆژەکە کرایەوە", "success");
      };

      img.src = payload.snapshot;
    } catch {
      showToast("فایلی پرۆژەکە دروست نییە", "error");
    }
  };

  reader.readAsText(file);
  event.target.value = "";
});

/* ---------- zoom ---------- */

document.querySelectorAll(".zoom-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    const action = btn.dataset.zoom;
    zoom += action === "in" ? 0.1 : -0.1;
    zoom = Math.max(0.3, Math.min(2.5, zoom));
    canvas.style.transform = `scale(${zoom})`;
    zoomLabel.textContent = `${Math.round(zoom * 100)}%`;
  });
});

/* ---------- shortcuts ---------- */

window.addEventListener("keydown", (event) => {
  const key = event.key.toLowerCase();

  if ((event.ctrlKey || event.metaKey) && key === "z" && event.shiftKey) {
    event.preventDefault();
    redo();
    return;
  }

  if ((event.ctrlKey || event.metaKey) && key === "z") {
    event.preventDefault();
    undo();
    return;
  }

  const shortcuts = {
    b: "brush",
    e: "eraser",
    t: "text",
    r: "rect",
    c: "circle",
    l: "line",
    h: "pan",
  };

  if (shortcuts[key]) {
    setTool(shortcuts[key]);
  }
});

/* ---------- pan ---------- */

stage.addEventListener("pointerdown", (event) => {
  if (currentTool !== "pan") return;

  isPanning = true;
  panStartX = event.clientX;
  panStartY = event.clientY;
  scrollLeftStart = stage.scrollLeft;
  scrollTopStart = stage.scrollTop;
  stage.style.cursor = "grabbing";
});

stage.addEventListener("pointermove", (event) => {
  if (!isPanning) return;

  const dx = event.clientX - panStartX;
  const dy = event.clientY - panStartY;

  stage.scrollLeft = scrollLeftStart - dx;
  stage.scrollTop = scrollTopStart - dy;
});

window.addEventListener("pointerup", () => {
  isPanning = false;
  if (currentTool === "pan") {
    stage.style.cursor = "grab";
  }
});

/* ---------- init ---------- */

createSliderValue(brushSize, " px");
createSliderValue(brightness, "%");
createSliderValue(contrast, "%");
createSliderValue(blurRange, " px");

const defaultFilterBtn = document.querySelector('.filter-btn[data-filter="none"]');
if (defaultFilterBtn) defaultFilterBtn.classList.add("active");

initializeCanvas();
setTool("brush");
