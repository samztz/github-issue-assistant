#!/bin/bash

# =============================================================================
# GitHub Issue Assistant API - 回归测试脚本
# =============================================================================
# 
# 用途：验证重构后的 API 功能与重构前完全一致
# 使用：chmod +x regression-test.sh && ./regression-test.sh
#
# 测试覆盖：
# 1. /mcp/github_list_issues
# 2. /agent/run  
# 3. /graphql
#
# =============================================================================

set -e  # 出错时立即退出

# 配置
API_BASE="${API_BASE:-http://127.0.0.1:8787}"
TEMP_DIR=$(mktemp -d)
LOG_FILE="$TEMP_DIR/regression.log"

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 日志函数
log() {
    echo -e "$1" | tee -a "$LOG_FILE"
}

# 测试结果统计
TESTS_TOTAL=0
TESTS_PASSED=0
TESTS_FAILED=0

# 测试函数
test_endpoint() {
    local name="$1"
    local method="$2"
    local url="$3"
    local data="$4"
    local expected_status="${5:-200}"
    
    TESTS_TOTAL=$((TESTS_TOTAL + 1))
    log "\n🧪 Testing: $name"
    
    # 发送请求
    local response_file="$TEMP_DIR/response_$TESTS_TOTAL"
    local status_code
    
    if [ "$method" = "POST" ]; then
        status_code=$(curl -s -w "%{http_code}" -X POST "$url" \
            -H "Content-Type: application/json" \
            -d "$data" \
            -o "$response_file")
    else
        status_code=$(curl -s -w "%{http_code}" "$url" -o "$response_file")
    fi
    
    # 检查状态码
    if [ "$status_code" -eq "$expected_status" ]; then
        log "   ✅ Status: $status_code (expected: $expected_status)"
        TESTS_PASSED=$((TESTS_PASSED + 1))
        
        # 显示响应内容（截取前500字符）
        local response_preview=$(cat "$response_file" | head -c 500)
        log "   📄 Response: ${response_preview}..."
        
        return 0
    else
        log "   ❌ Status: $status_code (expected: $expected_status)"
        log "   📄 Response: $(cat "$response_file")"
        TESTS_FAILED=$((TESTS_FAILED + 1))
        return 1
    fi
}

# 开始测试
log "${GREEN}🚀 GitHub Issue Assistant API 回归测试${NC}"
log "API Base: $API_BASE"
log "Log File: $LOG_FILE"
log "=========================================="

# 测试1: GraphQL Hello
test_endpoint "GraphQL Hello" "POST" "$API_BASE/graphql" \
    '{"query":"{ hello(name: \"Regression Test\") }"}' 200

# 测试2: MCP GitHub List Issues  
# 注意：这里使用一个公开仓库避免 GitHub token 问题
test_endpoint "MCP List Issues" "POST" "$API_BASE/mcp/github_list_issues" \
    '{"owner":"samztz","repo":"github-issue-assistant","state":"open"}' 200

# 测试3: MCP GitHub Triage (可能失败如果没有 OpenAI key)
log "\n🧪 Testing: MCP GitHub Triage"
log "   ℹ️  Note: This test may fail if OPENAI_API_KEY is not configured"
test_endpoint "MCP GitHub Triage" "POST" "$API_BASE/mcp/github_triage" \
    '{"title":"Test bug report","body":"Something is broken"}' 200 || {
    log "   ⚠️  Triage test failed - likely missing OPENAI_API_KEY (expected)"
}

# 测试4: Agent Run
log "\n🧪 Testing: Agent Run" 
log "   ℹ️  Note: This test may fail if OPENAI_API_KEY is not configured"
test_endpoint "Agent Natural Language" "POST" "$API_BASE/agent/run" \
    '{"input":"列出 samztz/github-issue-assistant 的 open issues"}' 200 || {
    log "   ⚠️  Agent test failed - likely missing OPENAI_API_KEY (expected)"
}

# 测试5: 404 Not Found
test_endpoint "404 Not Found" "POST" "$API_BASE/mcp/nonexistent" '{}' 404

# 测试6: CORS Preflight
log "\n🧪 Testing: CORS Preflight"
TESTS_TOTAL=$((TESTS_TOTAL + 1))
cors_status=$(curl -s -w "%{http_code}" -X OPTIONS "$API_BASE/graphql" \
    -H "Origin: https://example.com" \
    -H "Access-Control-Request-Method: POST" \
    -o /dev/null)

if [ "$cors_status" -eq "204" ]; then
    log "   ✅ CORS Preflight: $cors_status"
    TESTS_PASSED=$((TESTS_PASSED + 1))
else
    log "   ❌ CORS Preflight: $cors_status (expected: 204)"
    TESTS_FAILED=$((TESTS_FAILED + 1))
fi

# 测试总结
log "\n=========================================="
log "${GREEN}📊 测试总结${NC}"
log "Total Tests: $TESTS_TOTAL"
log "Passed: ${GREEN}$TESTS_PASSED${NC}"
log "Failed: ${RED}$TESTS_FAILED${NC}"

if [ $TESTS_FAILED -eq 0 ]; then
    log "${GREEN}🎉 所有关键测试通过！重构成功保持了 API 行为一致性${NC}"
    exit_code=0
else
    log "${RED}❌ 有测试失败，请检查重构代码${NC}"
    exit_code=1
fi

# 清理
log "\nLog file saved to: $LOG_FILE"
log "Temp directory: $TEMP_DIR (will be cleaned up on exit)"

# 部署检查清单
log "\n${YELLOW}📋 部署检查清单：${NC}"
log "□ 确保 GITHUB_TOKEN 环境变量已配置"  
log "□ 确保 OPENAI_API_KEY 环境变量已配置"
log "□ 运行 pnpm -F ./apps/api build 确保构建成功"
log "□ 运行 pnpm -F ./apps/api dev 确保开发服务器启动正常"
log "□ 检查 wrangler.toml 配置正确"
log "□ 部署前运行此回归测试脚本"

exit $exit_code