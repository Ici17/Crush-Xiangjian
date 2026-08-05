@echo off
chcp 65001 >nul
echo === Crush 香鉴 Vercel 部署脚本 ===
echo.

REM 检查是否在正确目录
if not exist "package.json" (
    echo 错误：请在 crushxiangjian 项目根目录运行此脚本
    exit /b 1
)

echo [1/4] 检查 Git 状态...
git status --short
echo.

echo [2/4] 确保 workflow 文件存在...
if not exist ".github\workflows\vercel.yml" (
    mkdir ".github\workflows" 2>nul
    (
echo name: Deploy to Vercel
echo.
echo on:
echo   push:
echo     branches: [main]
echo   workflow_dispatch:
echo.
echo jobs:
echo   deploy:
echo     runs-on: ubuntu-latest
echo     steps:
echo       - uses: actions/checkout@v4
echo.
echo       - uses: actions/setup-node@v4
echo         with:
echo           node-version: '20'
echo           cache: 'npm'
echo.
echo       - run: npm ci
echo.
echo       - run: npm run build
echo         env:
echo           WAFFO_PRIVATE_KEY: ${{ secrets.WAFFO_PRIVATE_KEY }}
echo           NEXT_PUBLIC_WAFFO_PRODUCT_DISCOUNTED: ${{ secrets.NEXT_PUBLIC_WAFFO_PRODUCT_DISCOUNTED }}
echo           NEXT_PUBLIC_WAFFO_PRODUCT_FULL: ${{ secrets.NEXT_PUBLIC_WAFFO_PRODUCT_FULL }}
echo           NEXT_PUBLIC_WAFFO_PRODUCT_SUBSCRIPTION: ${{ secrets.NEXT_PUBLIC_WAFFO_PRODUCT_SUBSCRIPTION }}
echo           NEXT_PUBLIC_BASE_URL: ${{ secrets.NEXT_PUBLIC_BASE_URL }}
echo.
echo       - uses: amondnet/vercel-action@v25
echo         with:
echo           vercel-token: ${{ secrets.VERCEL_TOKEN }}
echo           vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
echo           vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}
echo           vercel-args: '--prod'
    ) > ".github\workflows\vercel.yml"
    echo 已创建 workflow 文件
) else (
    echo workflow 文件已存在
)
echo.

echo [3/4] 提交并推送代码...
git add .
git commit -m "ci: setup Vercel deployment workflow" 2>nul || echo 无新变更需要提交
git push origin main
echo.

echo [4/4] 部署状态检查...
echo.
echo ==========================================
echo 部署流程已触发！
echo.
echo 请访问以下链接查看部署进度：
echo https://github.com/Ici17/Crush-Xiangjian/actions
echo.
echo 部署完成后访问：
echo https://crush-xiangjian.vercel.app
echo ==========================================

pause
