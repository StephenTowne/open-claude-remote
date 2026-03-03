#!/bin/bash
# Claude Code Remote - 一键安装脚本
# 安装完成后可直接使用 claude-remote 命令

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

info()  { echo -e "${BLUE}[INFO]${NC} $1"; }
ok()    { echo -e "${GREEN}[OK]${NC} $1"; }
warn()  { echo -e "${YELLOW}[WARN]${NC} $1"; }
error() { echo -e "${RED}[ERROR]${NC} $1"; }
hint()  { echo -e "${CYAN}[HINT]${NC} $1"; }

# ── 带重试机制的命令执行 ───────────────────────────────────
# 用法: retry <max_attempts> <command...>
# 指数退避: 3s → 6s → 12s
retry() {
  local max_attempts=$1
  shift
  local attempt=1
  local delay=3

  while [ $attempt -le $max_attempts ]; do
    if "$@"; then
      return 0
    fi

    if [ $attempt -lt $max_attempts ]; then
      warn "第 $attempt 次尝试失败，${delay}秒后重试..."
      sleep $delay
      delay=$((delay * 2))
    fi
    attempt=$((attempt + 1))
  done

  return 1
}

# ── 检测网络并建议镜像源 ───────────────────────────────────
detect_mirror() {
  info "检测网络环境..."

  # 尝试连接官方源
  if curl -s --max-time 5 https://registry.npmjs.org > /dev/null 2>&1; then
    ok "网络正常，使用官方源"
    return 0
  fi

  # 尝试淘宝镜像
  if curl -s --max-time 5 https://registry.npmmirror.com > /dev/null 2>&1; then
    warn "官方源连接超时，建议使用国内镜像"
    echo ""
    hint "执行以下命令配置淘宝镜像:"
    echo ""
    echo -e "  ${GREEN}cp .npmrc.example .npmrc${NC}"
    echo ""
    hint "或手动设置:"
    echo ""
    echo -e "  ${GREEN}pnpm config set registry https://registry.npmmirror.com${NC}"
    echo ""
    return 0
  fi

  # 两者都不通
  warn "网络检测失败，可能存在网络问题"
  return 0
}

# ── 检查编译工具（node-pty 依赖）────────────────────────────
check_build_tools() {
  info "检查编译工具（node-pty 需要）..."

  local missing_tools=()

  # 检测 OS 类型
  if [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS
    if ! command -v xcode-select &> /dev/null || ! xcode-select -p &> /dev/null; then
      missing_tools+=("Xcode Command Line Tools: xcode-select --install")
    else
      ok "Xcode Command Line Tools 已安装"
    fi
  elif [[ "$OSTYPE" == "linux"* ]]; then
    # Linux - 检查常见编译工具
    local has_compiler=false

    if command -v gcc &> /dev/null || command -v clang &> /dev/null; then
      has_compiler=true
    fi

    if ! $has_compiler; then
      missing_tools+=("编译器 (gcc/clang)")
    fi

    if ! command -v make &> /dev/null; then
      missing_tools+=("make")
    fi

    if command -v python3 &> /dev/null || command -v python &> /dev/null; then
      ok "Python 已安装"
    else
      missing_tools+=("Python (node-gyp 需要)")
    fi

    # 根据发行版给出安装建议
    if [ ${#missing_tools[@]} -gt 0 ]; then
      if command -v apt-get &> /dev/null; then
        missing_tools+=("安装命令: sudo apt-get install build-essential python3")
      elif command -v yum &> /dev/null; then
        missing_tools+=("安装命令: sudo yum groupinstall 'Development Tools' && sudo yum install python3")
      elif command -v dnf &> /dev/null; then
        missing_tools+=("安装命令: sudo dnf groupinstall 'Development Tools' && sudo dnf install python3")
      elif command -v pacman &> /dev/null; then
        missing_tools+=("安装命令: sudo pacman -S base-devel python")
      fi
    else
      ok "编译工具检查通过"
    fi
  fi

  # 输出缺失的工具
  if [ ${#missing_tools[@]} -gt 0 ]; then
    warn "以下编译工具可能缺失:"
    for tool in "${missing_tools[@]}"; do
      echo "  - $tool"
    done
    echo ""
    hint "node-pty 编译失败时，请先安装上述工具"
  fi
}

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
  if ! npm install -g pnpm@latest; then
    error "pnpm 安装失败

${CYAN}[解决方法]${NC}
1. 检查 npm 是否可用: npm -v
2. 尝试使用管理员权限: sudo npm install -g pnpm@latest
3. 或使用 corepack: corepack enable && corepack prepare pnpm@latest --activate"
  fi
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

# ── 2. 检查编译工具 ───────────────────────────────────────

check_build_tools

echo ""

# ── 3. 检测网络环境 ───────────────────────────────────────

detect_mirror

# ── 4. 安装依赖 ───────────────────────────────────────────

info "安装项目依赖（最多重试3次）..."

if ! retry 3 pnpm install; then
  error "依赖安装失败

${CYAN}[常见解决方法]${NC}

1. 网络超时/连接失败:
   ${GREEN}cp .npmrc.example .npmrc${NC}  # 使用淘宝镜像
   ${GREEN}pnpm install${NC}

2. node-pty 编译失败:
   - macOS: ${GREEN}xcode-select --install${NC}
   - Ubuntu/Debian: ${GREEN}sudo apt-get install build-essential python3${NC}
   - Fedora/RHEL: ${GREEN}sudo dnf groupinstall 'Development Tools'${NC}

3. 权限不足:
   - 检查 pnpm 全局目录权限: ${GREEN}pnpm config get global-bin-dir${NC}
   - 如需修复: ${GREEN}pnpm setup${NC} 或手动配置目录

4. 清理缓存后重试:
   ${GREEN}pnpm store prune${NC}
   ${GREEN}rm -rf node_modules pnpm-lock.yaml${NC}
   ${GREEN}pnpm install${NC}
"
fi
ok "依赖安装完成"

echo ""

# ── 5. 构建项目 ───────────────────────────────────────────

info "构建项目 (shared → frontend → backend)..."
if ! pnpm build; then
  error "构建失败

${CYAN}[排查步骤]${NC}
1. 检查 Node.js 版本: ${GREEN}node -v${NC} (需要 >= 20)
2. 检查 TypeScript 编译: ${GREEN}npx tsc --noEmit${NC}
3. 查看详细错误: ${GREEN}pnpm build 2>&1 | tee build.log${NC}"
fi
ok "构建完成"

echo ""

# ── 6. 全局链接命令 ────────────────────────────────────────

info "全局链接 claude-remote 命令..."

# 检查 pnpm 全局目录是否配置，未配置则自动初始化
GLOBAL_BIN_DIR=$(pnpm config get global-bin-dir 2>/dev/null)
if [ -z "$GLOBAL_BIN_DIR" ] || [ "$GLOBAL_BIN_DIR" = "undefined" ]; then
  info "初始化 pnpm 全局目录..."
  pnpm setup 2>/dev/null || true
  # 将 pnpm 全局目录添加到当前进程的 PATH
  if [ -f "$HOME/.zshrc" ] || [ -f "$HOME/.bashrc" ]; then
    export PATH="$HOME/Library/pnpm:$PATH"
  fi
fi

# 切换到 backend 目录执行全局链接（bin 字段定义在 backend/package.json）
cd backend
if ! pnpm link -g; then
  error "全局链接失败

${CYAN}[解决方法]${NC}
1. 检查 pnpm 全局目录权限
2. 或使用相对路径运行: ${GREEN}node backend/dist/cli.js${NC}"
fi
cd ..
ok "claude-remote 命令已注册"

echo ""

# ── 7. 验证安装 ───────────────────────────────────────────

info "验证安装..."
if command -v claude-remote &> /dev/null; then
  ok "claude-remote 命令可用"
else
  # pnpm link 后可能需要刷新 PATH
  warn "claude-remote 命令未在 PATH 中找到"
  hint "请执行: source ~/.bashrc 或 source ~/.zshrc，然后重新打开终端"
  hint "或直接运行: node backend/dist/cli.js"
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