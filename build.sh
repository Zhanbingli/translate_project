#!/bin/bash

# WordSaver Extension 自动构建脚本
# 更新版本：v2.1.0 - 简化版本，专注核心功能

set -e

# 定义版本号
VERSION="2.1.0"
BUILD_DIR="wordsaver-v${VERSION}"
ZIP_NAME="${BUILD_DIR}.zip"

# 创建输出目录
echo "🏗️  开始构建 WordSaver v${VERSION}..."
echo "清理旧的构建文件..."

# 清理旧文件
rm -rf "${BUILD_DIR}" "${ZIP_NAME}" wordsaver-v*.zip 2>/dev/null || true

# 创建构建目录
mkdir -p "${BUILD_DIR}"

echo "📦 复制核心文件..."

# 复制核心文件
cp manifest.json "${BUILD_DIR}/"
cp popup.html "${BUILD_DIR}/"
cp popup.js "${BUILD_DIR}/"
cp styles.css "${BUILD_DIR}/"
cp content.js "${BUILD_DIR}/"
cp background.js "${BUILD_DIR}/"

# 复制图标（如果存在）
cp icon.svg "${BUILD_DIR}/" 2>/dev/null || echo "⚠️  icon.svg 不存在，跳过"

# 复制文档文件
echo "📄 复制文档文件..."
cp README.md "${BUILD_DIR}/" 2>/dev/null || echo "⚠️  README.md 不存在，跳过"
cp PUBLISH_GUIDE.md "${BUILD_DIR}/" 2>/dev/null || echo "⚠️  PUBLISH_GUIDE.md 不存在，跳过"
cp QUICK_START.md "${BUILD_DIR}/" 2>/dev/null || echo "⚠️  QUICK_START.md 不存在，跳过"

# 检查文件大小
echo "📊 检查文件大小..."
ls -la "${BUILD_DIR}"

# 创建ZIP包
echo "🗜️  创建ZIP包..."
zip -r "${ZIP_NAME}" "${BUILD_DIR}"/*

# 显示最终结果
echo "✅ 构建完成！"
echo "📦 输出文件: ${ZIP_NAME}"
echo "📏 文件大小: $(du -h ${ZIP_NAME} | cut -f1)"

echo ""
echo "🚀 发布步骤："
echo "1. 解压 ${ZIP_NAME} 检查文件"
echo "2. 访问 Chrome Web Store Developer Dashboard"
echo "3. 上传 ${ZIP_NAME} 文件"
echo "4. 填写应用描述和截图"
echo "5. 提交审核"

echo ""
echo "🔧 本次更新内容："
echo "- 简化用户界面，专注核心功能"
echo "- 只保留单词显示、搜索、删除功能"
echo "- 移除复杂的学习和测试功能"
echo "- 提供更稳定的用户体验"

echo ""
echo "🎉 准备就绪，可以发布了！" 