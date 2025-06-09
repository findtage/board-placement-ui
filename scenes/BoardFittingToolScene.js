export class BoardFittingToolScene extends Phaser.Scene {
  constructor() {
    super("BoardFittingTool");
    this.currentIndex = 0;
    this.entries = [];
    this.uniqueEntries = [];
    this.dimensionsSeen = new Set();
    this.boardSprites = [];
    this.avatarParts = [];
    this.offsetX = 0;
    this.offsetY = 0;
    this.layerAbove = true;
    this.middleEffect = false;
    this.fitResults = JSON.parse(localStorage.getItem("fitResults") || "{}");
    this.infoText = null;
    this.fullPreviewSprites = [];
    this.frameDropdown = null;
    this.selectedFrame = 0;
  }

  preload() {
    this.load.html("dropdown", "assets/html/dropdown.html");
    this.load.json("boardsMetadata", "assets/boards/boards_metadata.json");

    this.load.spritesheet("body-0", "assets/female/body-0.png", { frameWidth: 58, frameHeight: 89 });
    this.load.spritesheet("brow-0", "assets/female/brow-0.png", { frameWidth: 45, frameHeight: 48 });
    this.load.image("face-0", "assets/female/face-0.png");
    this.load.spritesheet("lips-0", "assets/female/lips-0.png", { frameWidth: 45, frameHeight: 48 });
    this.load.spritesheet("mbody-0", "assets/male/mbody-0.png", { frameWidth: 62, frameHeight: 96 });
    this.load.spritesheet("new-eyes-4", "assets/female/new-eyes-4.png", { frameWidth: 45, frameHeight: 48 });
  }

  create() {
    const metadata = this.cache.json.get("boardsMetadata");
    this.entries = Object.entries(metadata);
    this.uniqueEntries = this.entries.filter(([id, data]) => {
      const key = `${data.splitX}x${data.splitY}`;
      if (this.dimensionsSeen.has(key)) return false;
      this.dimensionsSeen.add(key);
      return true;
    });

    this.createAvatar();
    this.createUI();
    this.createDropdown();
    this.loadBoard();

    this.input.keyboard.on("keydown-N", () => this.next());
    this.input.keyboard.on("keydown-P", () => this.prev());
    this.input.keyboard.on("keydown-M", () => this.toggleMiddle());
    this.input.keyboard.on("keydown-L", () => this.toggleLayer());
    this.input.keyboard.on("keydown-S", () => this.saveCurrent());
    this.input.keyboard.on("keydown-B", () => this.exportBatch());
  }

  createAvatar() {
    const baseX = 400, baseY = 300;
    const add = (key, x, y, frame = null) => {
      const sprite = frame !== null ? this.add.sprite(baseX + x, baseY + y, key, frame) : this.add.image(baseX + x, baseY + y, key);
      this.avatarParts.push(sprite);
    };
    add("body-0", 7, -72, 0);
    add("face-0", 1, -100);
    add("brow-0", 1, -100, 0);
    add("lips-0", 2, -100, 0);
    add("new-eyes-4", 1, -101, 0);
    add("mbody-0", 3, -76, 0);
  }

  createUI() {
    this.infoText = this.add.text(10, 10, "", { fontSize: "14px", fill: "#fff" });
    this.add.text(10, 580, "[← Prev] [→ Next] [M] Middle [L] Layer [S] Save [E] Export [B] Batch", { fontSize: "14px", fill: "#aaa" });
    this.cursors = this.input.keyboard.createCursorKeys();

    const exportBtn = this.add.text(720, 560, "[Export]", {
      fontSize: "14px",
      fill: "#00ff00",
      backgroundColor: "#222",
      padding: { left: 8, right: 8, top: 4, bottom: 4 }
    }).setInteractive().setScrollFactor(0);
    exportBtn.on("pointerdown", () => this.exportFitResults());
  }

  createDropdown() {
    const select = document.createElement("select");
    select.style.position = "absolute";
    select.style.top = "40px";
    select.style.left = "10px";
    this.uniqueEntries.forEach(([id, data], i) => {
      const option = document.createElement("option");
      option.value = i;
      option.text = `${id} (${data.splitX}x${data.splitY})`;
      select.appendChild(option);
    });
    select.addEventListener("change", (e) => {
      this.currentIndex = parseInt(e.target.value);
      this.loadBoard();
    });
    document.body.appendChild(select);
  }

  update() {
    let moved = false;
    if (this.cursors.left.isDown) { this.offsetX--; moved = true; }
    if (this.cursors.right.isDown) { this.offsetX++; moved = true; }
    if (this.cursors.up.isDown) { this.offsetY--; moved = true; }
    if (this.cursors.down.isDown) { this.offsetY++; moved = true; }
    if (moved) this.updateBoardPosition();
  }

  loadBoard() {
    const [id, data] = this.uniqueEntries[this.currentIndex];
    this.currentId = id;
    this.currentData = data;

    if (!this.fitResults[id]) {
      this.fitResults[id] = {
        offsetX: 0,
        offsetY: 0,
        middleEffect: false,
        layer: "above",
        selectedFrame: 0
      };
    }

    const saved = this.fitResults[id];
    this.offsetX = saved.offsetX;
    this.offsetY = saved.offsetY;
    this.middleEffect = saved.middleEffect;
    this.layerAbove = saved.layer === "above";
    this.selectedFrame = saved.selectedFrame || 0;

    this.load.spritesheet(id, data.path, { frameWidth: data.splitX, frameHeight: data.splitY });
    this.load.once("complete", () => this.spawnBoard());
    this.load.start();
  }

  spawnBoard() {
    const tex = this.textures.get(this.currentId);
    const lastFrameIndex = tex.frameTotal - 1;
    this.clearBoards();

    const baseX = 400 + this.offsetX;
    const baseY = 300 + this.offsetY;

    if (this.middleEffect && lastFrameIndex > 0) {
      const behind = this.add.sprite(baseX, baseY, this.currentId, this.layerAbove ? 0 : lastFrameIndex-1);
      const front = this.add.sprite(baseX, baseY, this.currentId, this.layerAbove ? lastFrameIndex-1 : 0);
      this.boardSprites.push(behind, front);
      this.children.sendToBack(behind);
      this.avatarParts.forEach(p => this.children.bringToTop(p));
      this.children.bringToTop(front);
    } else {
      const sprite = this.add.sprite(baseX, baseY, this.currentId, this.selectedFrame);
      this.boardSprites.push(sprite);
      if (this.layerAbove) {
        this.children.bringToTop(sprite);
      } else {
        this.children.sendToBack(sprite);
      }
    }

    this.fullPreviewSprites.forEach(s => s.destroy());
    this.fullPreviewSprites = [];
    for (let i = 0; i < lastFrameIndex; i++) {
      const x = 720 + (i % 2) * (this.currentData.splitX + 10);
      const y = 20 + Math.floor(i / 2) * (this.currentData.splitY + 4);
      const preview = this.add.image(x, y, this.currentId, i).setOrigin(0).setInteractive();
      preview.on("pointerdown", () => {
        this.selectedFrame = i;
        this.fitResults[this.currentId].selectedFrame = i;
        this.spawnBoard();
      });
      this.fullPreviewSprites.push(preview);
    }

    this.enableDragging();
    this.updateInfo();
  }

  enableDragging() {
    this.boardSprites.forEach(sprite => {
      sprite.setInteractive();
      this.input.setDraggable(sprite);
    });
    this.input.on("drag", (pointer, gameObject, dragX, dragY) => {
      this.offsetX = dragX - 400;
      this.offsetY = dragY - 300;
      this.updateBoardPosition();
    });
  }

  updateBoardPosition() {
    const baseX = 400 + this.offsetX;
    const baseY = 300 + this.offsetY;
    this.boardSprites.forEach(s => { s.x = baseX; s.y = baseY; });
    this.updateInfo();
  }

  updateInfo() {
    this.infoText.setText(
      `Board: ${this.currentId} (${this.currentData.splitX}x${this.currentData.splitY}) | Offset: (${this.offsetX}, ${this.offsetY}) | Middle: ${this.middleEffect} | LayerAbove: ${this.layerAbove}`
    );
  }

  toggleMiddle() {
    this.middleEffect = !this.middleEffect;
    this.fitResults[this.currentId].middleEffect = this.middleEffect;
    this.spawnBoard();
  }

  toggleLayer() {
    this.layerAbove = !this.layerAbove;
    this.fitResults[this.currentId].layer = this.layerAbove ? "above" : "below";
    this.spawnBoard();
  }

  next() {
    this.currentIndex = (this.currentIndex + 1) % this.uniqueEntries.length;
    this.loadBoard();
  }

  prev() {
    this.currentIndex = (this.currentIndex - 1 + this.uniqueEntries.length) % this.uniqueEntries.length;
    this.loadBoard();
  }

  clearBoards() {
    this.boardSprites.forEach(s => s.destroy());
    this.boardSprites = [];
    this.fullPreviewSprites.forEach(s => s.destroy());
    this.fullPreviewSprites = [];
  }

  saveCurrent() {
    this.fitResults[this.currentId] = {
      offsetX: this.offsetX,
      offsetY: this.offsetY,
      middleEffect: this.middleEffect,
      layer: this.layerAbove ? "above" : "below",
      selectedFrame: this.selectedFrame
    };
    localStorage.setItem("fitResults", JSON.stringify(this.fitResults));
    console.log("Saved", this.fitResults);
  }

  exportFitResults() {
    const dataStr = JSON.stringify(this.fitResults, null, 2);
    const blob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "board_fit_results.json";
    a.click();
    URL.revokeObjectURL(url);
  }

  exportBatch() {
    this.uniqueEntries.forEach(([id], i) => {
      const result = this.fitResults[id];
      if (result) console.log(`Board ${id} =>`, result);
    });
    alert("Batch results logged to console.");
  }
}



