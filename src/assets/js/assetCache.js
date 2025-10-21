class AssetCache {
    constructor(basePath = SPRITES_FOLDER) {
        this.basePath = basePath;
        this.images = new Map();
    }

    getOrLoadImage(relativePath) {
        const fullPath = this.basePath + relativePath;
        if (this.images.has(fullPath)) return this.images.get(fullPath);
        const img = new Image();
        img.src = fullPath;
        this.images.set(fullPath, img);
        return img;
    }

    preloadPaths(paths) {
        const unique = Array.from(new Set(paths));
        const promises = unique.map(p => new Promise(resolve => {
            const img = this.getOrLoadImage(p);
            if (img.complete && img.naturalWidth > 0) { resolve(); return; }
            const done = () => resolve();
            img.addEventListener('load', done, { once: true });
            img.addEventListener('error', done, { once: true });
        }));
        return Promise.all(promises);
    }

    preloadPlayerSprites(playerController) {
        const paths = playerController.getAllSpritePaths();
        return this.preloadPaths(paths);
    }
}


