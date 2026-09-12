#!/bin/bash
# 把「体彩·福彩 多游戏智能参考中心」打包成单个便携压缩包（含官方历史数据）
# 用法：bash multi/scripts/package-portable.sh
set -e
HERE="$(cd "$(dirname "$0")" && pwd)"        # .../multi/scripts
MULTI="$(cd "$HERE/.." && pwd)"               # .../multi
OUT_DIR="$(cd "$HERE/../.." && pwd)"          # 个人主页/
STAMP="$(date +%Y%m%d)"
ZIP="$OUT_DIR/lottery-multi-portable-$STAMP.zip"
cd "$MULTI/.."
rm -f "$ZIP"
zip -rq "$ZIP" multi -x "*.DS_Store" -x "*/.DS_Store"
echo "✔ 已生成便携压缩包："
echo "  $ZIP"
echo "  （大小：$(du -h "$ZIP" | cut -f1)）"
echo
echo "在另一台电脑上："
echo "  1) 解压后进入 multi 目录"
echo "  2) Mac 双击「start-mac.command」 / Windows 双击「start-win.bat」"
echo "  3) 浏览器打开 http://127.0.0.1:8790  （手机同 Wi-Fi 用页面右上角📱获取局域网地址）"
