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
let imageData = null;

const history = [];
let historyIndex = -1;

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
  document.querySelectorAll(".tool-btn").forEach((btn) => {
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
  const composedFilter = [
    currentFilter,
    `brightness(${brightness.value}%)`,
    `contrast(${contrast.value}%)`,
    `blur(${blurRange.value}px)`
  ].join(" ");
  ctx.filter = composedFilter;
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
    ctx.drawImage(img, 0, 0);
  };
  img.src = history[index];
}

function undo() {
  if (historyIndex > 0) {
    historyIndex -= 1;
    restoreState(historyIndex);
  }
}

function redo() {
  if (historyIndex < history.length - 1) {
    historyIndex += 1;
    restoreState(historyIndex);
  }
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

canvas.addEventListener("mousedown", (event) => {
  if (currentTool === "pan") return;
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
    if (text) {
      applyContextStyle();
      ctx.font = `${Math.max(18, Number(brushSize.value) * 4)}px Noto Sans Arabic`;
      ctx.fillText(text, x, y);
      saveState();
    }
    drawing = false;
  }
});

canvas.addEventListener("mousemove", (event) => {
  if (!drawing) return;
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
});

window.addEventListener("mouseup", () => {
  if (!drawing) return;
  drawing = false;
  ctx.globalCompositeOperation = "source-over";
  ctx.filter = "none";
  saveState();
});

document.querySelectorAll(".tool-btn[data-tool]").forEach((btn) => {
  btn.addEventListener("click", () => setTool(btn.dataset.tool));
});

document.getElementById("clearCanvas").addEventListener("click", () => {
  if (!window.confirm("دڵنیایت کە بومەکە پاک دەکەیتەوە؟")) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  saveState();
});

document.getElementById("undoBtn").addEventListener("click", undo);
document.getElementById("redoBtn").addEventListener("click", redo);

document.querySelectorAll(".filter-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    currentFilter = btn.dataset.filter;
  });
});

[brightness, contrast, blurRange, colorPicker, brushSize].forEach((input) => {
  input.addEventListener("input", () => {
    if (currentTool !== "brush" && currentTool !== "eraser") return;
    applyContextStyle();
  });
});

document.getElementById("newProject").addEventListener("click", () => {
  if (!window.confirm("پرۆژەی نوێ دروست بکرێت؟")) return;
  ctx.filter = "none";
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  saveState();
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
    };
    img.src = readerEvent.target.result;
  };
  reader.readAsDataURL(file);
});

function downloadImage(type) {
  const link = document.createElement("a");
  link.download = `kurd-designer.${type === "image/png" ? "png" : "jpg"}`;
  link.href = canvas.toDataURL(type, 0.95);
  link.click();
}

document.getElementById("downloadPng").addEventListener("click", () => downloadImage("image/png"));
document.getElementById("downloadJpg").addEventListener("click", () => downloadImage("image/jpeg"));

document.querySelectorAll(".zoom-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    const action = btn.dataset.zoom;
    zoom += action === "in" ? 0.1 : -0.1;
    zoom = Math.max(0.3, Math.min(2.5, zoom));
    canvas.style.transform = `scale(${zoom})`;
    zoomLabel.textContent = `${Math.round(zoom * 100)}%`;
  });
});

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
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        saveState();
      };
      img.src = payload.snapshot;
    } catch (error) {
      alert("فایلی پرۆژەکە دروست نییە.");
    }
  };
  reader.readAsText(file);
});

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
  };

  if (shortcuts[key]) {
    setTool(shortcuts[key]);
  }
});

let isPanning = false;
let panStartX = 0;
let panStartY = 0;
let scrollLeftStart = 0;
let scrollTopStart = 0;

stage.addEventListener("mousedown", (event) => {
  if (currentTool !== "pan") return;
  isPanning = true;
  panStartX = event.clientX;
  panStartY = event.clientY;
  scrollLeftStart = stage.scrollLeft;
  scrollTopStart = stage.scrollTop;
  stage.style.cursor = "grabbing";
});

stage.addEventListener("mousemove", (event) => {
  if (!isPanning) return;
  const dx = event.clientX - panStartX;
  const dy = event.clientY - panStartY;
  stage.scrollLeft = scrollLeftStart - dx;
  stage.scrollTop = scrollTopStart - dy;
});

window.addEventListener("mouseup", () => {
  isPanning = false;
  if (currentTool === "pan") {
    stage.style.cursor = "grab";
  }
});

initializeCanvas();
setTool("brush");
