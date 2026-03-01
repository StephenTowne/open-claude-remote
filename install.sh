#!/bin/bash
# Claude Code Remote - 一键安装脚本
# 安装完成后可直接使用 claude-remote 命令

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

info()  { echo -e "${BLUE}[INFO]${NC} $1"; }
ok()    { echo -e "${GREEN}[OK]${NC} $1"; }
warn()  { echo -e "${YELLOW}[WARN]${NC} $1"; }
error() { echo -e "${RED}[ERROR]${NC} $1"; exit 1; }

echo ""
echo -e "${GREEN}╔══════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║   Claude Code Remote - 一键安装脚本     ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════╝${NC}"
echo ""

# ── 1. 检查前置条件 ──────────────────────────────────────

info "检查前置条件..."

# Node.js >= 20
if ! command -v node &> /dev/null; then
  error "未找到 Node.js，请先安装 Node.js >= 20: https://nodejs.org/"
fi

NODE_VERSION=$(node -v | sed 's/v//' | cut -d. -f1)
if [ "$NODE_VERSION" -lt 20 ]; then
  error "Node.js 版本过低 ($(node -v))，需要 >= 20"
fi
ok "Node.js $(node -v)"

# pnpm
if ! command -v pnpm &> /dev/null; then
  warn "未找到 pnpm，正在安装..."
  npm install -g pnpm@latest || error "pnpm 安装失败"
  ok "pnpm 已安装"
else
  ok "pnpm $(pnpm -v)"
fi

# Claude Code CLI
if ! command -v claude &> /dev/null; then
  warn "未找到 Claude Code CLI"
  warn "请参考: https://docs.anthropic.com/en/docs/claude-code"
  warn "安装后可正常使用 claude-remote"
else
  ok "Claude Code CLI 已安装"
fi

# jq（用于 JSON 处理，可选）
if ! command -v jq &> /dev/null; then
  warn "未找到 jq（可选工具）"
else
  ok "jq $(jq --version)"
fi

echo ""

# ── 2. 安装依赖 ───────────────────────────────────────────

info "安装项目依赖..."
pnpm install || error "依赖安装失败"
ok "依赖安装完成"

echo ""

# ── 3. 构建项目 ───────────────────────────────────────────

info "构建项目 (shared → frontend → backend)..."
pnpm build || error "构建失败"
ok "构建完成"

echo ""

# ── 4. 全局链接命令 ────────────────────────────────────────

info "全局链接 claude-remote 命令..."
pnpm link -g || error "全局链接失败"
ok "claude-remote 命令已注册"

echo ""

# ── 5. 验证安装 ───────────────────────────────────────────

info "验证安装..."
if command -v claude-remote &> /dev/null; then
  ok "claude-remote 命令可用"
else
  # pnpm link 后可能需要刷新 PATH
  warn "claude-remote 命令未在 PATH 中找到"
  warn "请尝试: source ~/.bashrc 或 source ~/.zshrc，然后重新打开终端"
fi

echo ""
echo -e "${GREEN}╔══════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║          安装完成！                      ║${NC}"
echo -e "${GREEN}╠══════════════════════════════════════════╣${NC}"
echo -e "${GREEN}║                                          ║${NC}"
echo -e "${GREEN}║  使用方式:                               ║${NC}"
echo -e "${GREEN}║    cd your-project                       ║${NC}"
echo -e "${GREEN}║    claude-remote                         ║${NC}"
echo -e "${GREEN}║                                          ║${NC}"
echo -e "${GREEN}║  更多选项:                               ║${NC}"
echo -e "${GREEN}║    claude-remote --help                  ║${NC}"
echo -e "${GREEN}║                                          ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════╝${NC}"
echo ""
