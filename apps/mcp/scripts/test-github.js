#!/usr/bin/env node

// 简单测试 GitHub API 连接
import { config } from 'dotenv';
import { fetch } from 'undici';

// 加载环境变量
config();

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;

async function testUserAPI() {
  console.log("🔍 测试 GitHub API 连接...");
  
  const response = await fetch("https://api.github.com/user", {
    headers: {
      "Authorization": `Bearer ${GITHUB_TOKEN}`,
      "Accept": "application/vnd.github+json",
      "User-Agent": "mcp-github-issue-assistant-test"
    }
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    console.log(`❌ GitHub API 连接失败: ${response.status}`);
    console.log(`错误信息: ${errorText}`);
    process.exit(1);
  }
  
  const user = await response.json();
  console.log("✅ GitHub API 连接成功!");
  console.log(`📋 认证用户: ${user.login} (${user.name || 'No name'})`);
  
  return user;
}

async function testReposAPI() {
  console.log("\n🔍 测试获取仓库列表...");
  
  const reposResponse = await fetch("https://api.github.com/user/repos?per_page=3", {
    headers: {
      "Authorization": `Bearer ${GITHUB_TOKEN}`,
      "Accept": "application/vnd.github+json",
      "User-Agent": "mcp-github-issue-assistant-test"
    }
  });
  
  if (!reposResponse.ok) {
    console.log(`❌ 仓库列表获取失败: ${reposResponse.status}`);
    process.exit(1);
  }
  
  const repos = await reposResponse.json();
  console.log("✅ 仓库列表获取成功!");
  console.log("📁 前3个仓库:");
  repos.forEach((repo, index) => {
    console.log(`   ${index + 1}. ${repo.full_name} (${repo.private ? 'private' : 'public'})`);
  });
  
  return repos;
}

async function testIssuesAPI(repo) {
  console.log(`\n🔍 测试获取 ${repo.full_name} 的 issues...`);
  
  const issuesResponse = await fetch(`https://api.github.com/repos/${repo.full_name}/issues?per_page=2`, {
    headers: {
      "Authorization": `Bearer ${GITHUB_TOKEN}`,
      "Accept": "application/vnd.github+json",
      "User-Agent": "mcp-github-issue-assistant-test"
    }
  });
  
  if (!issuesResponse.ok) {
    console.log(`⚠️  Issues 获取失败: ${issuesResponse.status}`);
    process.exit(1);
  }
  
  const issues = await issuesResponse.json();
  console.log("✅ Issues 获取成功!");
  console.log(`📝 找到 ${issues.length} 个 issue`);
  
  if (issues.length > 0) {
    issues.forEach((issue, index) => {
      console.log(`   ${index + 1}. #${issue.number}: ${issue.title}`);
    });
  }
  
  return issues;
}

async function testGitHubAPI() {
  try {
    // 检查环境变量
    if (!GITHUB_TOKEN) {
      console.log("❌ GitHub token 未设置！请在 .env 文件中设置 GITHUB_TOKEN");
      process.exit(1);
    }
    
    // 测试用户 API
    const user = await testUserAPI();
    
    // 测试仓库 API
    const repos = await testReposAPI();
    
    // 如果有仓库，测试 Issues API
    if (repos.length > 0) {
      await testIssuesAPI(repos[0]);
    } else {
      console.log("\n📝 没有找到仓库，跳过 Issues 测试");
    }
    
    console.log("\n🎉 所有测试通过！MCP GitHub API 功能正常");
    
  } catch (error) {
    console.log(`❌ 网络错误: ${error.message}`);
    process.exit(1);
  }
}

testGitHubAPI();