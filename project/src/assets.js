export class AssetLoader {
  constructor() {
    // Resolved images are kept here; pending promises prevent duplicate requests.
    this.cache = new Map();
    this.pending = new Map();
  }

  loadImage(id, src) {
    if (this.cache.has(id)) return Promise.resolve(this.cache.get(id));
    if (this.pending.has(id)) return this.pending.get(id);

    const promise = new Promise((resolve) => {
      const image = new Image();
      const finish = () => {
        this.cache.set(id, image);
        this.pending.delete(id);
        resolve(image);
      };
      image.onload = finish;
      image.onerror = finish;
      image.src = src;
    });

    this.pending.set(id, promise);
    return promise;
  }

  preload(assets = []) {
    return Promise.all(
      assets.map(({ id, src }) => this.loadImage(id, src).catch(() => null)),
    );
  }
}
