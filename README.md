# Phaser Mobile 2048

当前版本：v0.14.0-full-board-goals

一款使用 Phaser 3 + TypeScript + Vite 开发的竖屏手游版 2048。

## 功能

- 手机滑动与桌面键盘控制
- 分数、最高分与本地自动存档
- 撤销、重新开始、胜利与失败状态
- 母棋子随机入场，开局受控喷满棋盘并保证存在合法合并
- 顺序数字阶段目标，完成后自动收取棋子并释放格子
- 每次有效滑动后继续喷发一枚新棋子
- 倒计时关卡与4类、16种障碍物实验关
- 1080 × 1920 设计分辨率，自动适配手机屏幕
- GitHub Actions 自动构建并部署 GitHub Pages

## 本地运行

```bash
npm install
npm run dev
```

生产构建：

```bash
npm run build
```

每次推送到 `main` 后，`.github/workflows/deploy-web.yml` 会自动构建并发布 Web 版本。
