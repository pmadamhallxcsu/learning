/**
 * LinksAPI Cookie 调试脚本
 * 用于诊断认证失败的具体原因
 */

const axios = require('axios');

// 从命令行参数或环境变量读取 Cookie
const COOKIE = process.argv[2] || process.env.LINKSAPI_COOKIE;
const BASE_URL = process.env.LINKSAPI_URL || 'https://api.linksapi.cn';

console.log('==================== Cookie 调试信息 ====================');
console.log('BASE_URL:', BASE_URL);
console.log('Cookie 长度:', COOKIE ? COOKIE.length : 0);
console.log('');

if (!COOKIE) {
    console.error('❌ 未提供 Cookie');
    console.log('');
    console.log('使用方法:');
    console.log('  node linksapi_debug.js "你的完整Cookie"');
    console.log('');
    console.log('或设置环境变量:');
    console.log('  set LINKSAPI_COOKIE=你的完整Cookie');
    console.log('  node linksapi_debug.js');
    process.exit(1);
}

// 解析 Cookie 字段
const sessionMatch = COOKIE.match(/session=([^;]+)/);
const newApiUserMatch = COOKIE.match(/new-api-user=([^;]+)/);

console.log('📋 Cookie 字段检测:');
console.log('  session:', sessionMatch ? '✅ 存在' : '❌ 缺失');
console.log('  new-api-user:', newApiUserMatch ? '✅ 存在' : '❌ 缺失');
console.log('');

if (!sessionMatch) {
    console.error('❌ Cookie 格式错误：缺少 session 字段');
    console.log('💡 请确保复制完整的 Cookie，包含 session=xxx');
    process.exit(1);
}

// 显示 Cookie 示例格式（脱敏）
const sessionValue = sessionMatch[1];
console.log('  session 值:', sessionValue.substring(0, 20) + '...' + sessionValue.substring(sessionValue.length - 10));
if (newApiUserMatch) {
    console.log('  new-api-user 值:', newApiUserMatch[1].substring(0, 20) + '...');
}
console.log('');

// 测试请求
async function testRequest() {
    const headers = {
        'accept': 'application/json, text/plain, */*',
        'accept-language': 'zh-CN,zh;q=0.9,en;q=0.8',
        'cache-control': 'no-store',
        'origin': BASE_URL,
        'referer': `${BASE_URL}/profile`,
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36',
        'cookie': COOKIE
    };

    if (newApiUserMatch) {
        headers['new-api-user'] = newApiUserMatch[1];
    }

    console.log('🔍 正在测试签到接口...');
    console.log('请求地址:', `${BASE_URL}/api/user/checkin`);
    console.log('');

    try {
        const response = await axios.post(
            `${BASE_URL}/api/user/checkin`,
            {},
            {
                headers: headers,
                timeout: 15000,
                validateStatus: () => true // 接受所有状态码
            }
        );

        console.log('📡 响应信息:');
        console.log('  状态码:', response.status);
        console.log('  状态文本:', response.statusText);
        console.log('');
        console.log('📦 响应数据:');
        console.log(JSON.stringify(response.data, null, 2));
        console.log('');

        // 分析错误
        if (response.status === 401 || response.status === 403) {
            console.error('❌ 认证失败 (HTTP ' + response.status + ')');
            console.log('');
            console.log('💡 可能的原因:');
            console.log('  1. Cookie 已过期，需要重新登录网站获取');
            console.log('  2. session 字段不正确');
            console.log('  3. 网站更新了认证机制');
            console.log('  4. IP 地址变化导致会话失效');
            console.log('');
            console.log('🔧 解决方案:');
            console.log('  1. 打开浏览器，访问', BASE_URL);
            console.log('  2. 登录账号');
            console.log('  3. 按 F12 打开开发者工具');
            console.log('  4. 切换到 Network(网络) 标签');
            console.log('  5. 刷新页面');
            console.log('  6. 点击任意请求，找到 Request Headers');
            console.log('  7. 复制完整的 Cookie 值（包含所有字段）');
        } else if (response.status === 200 && response.data.success) {
            console.log('✅ Cookie 有效，签到成功！');
        } else if (response.status === 400 && response.data.message?.includes('已签到')) {
            console.log('✅ Cookie 有效，但今日已签到过');
        } else {
            console.log('⚠️  未知响应，请检查上面的响应数据');
        }

    } catch (error) {
        console.error('❌ 请求失败:', error.message);
        if (error.code === 'ENOTFOUND') {
            console.log('💡 域名无法解析，请检查网络连接或 LINKSAPI_URL 是否正确');
        } else if (error.code === 'ETIMEDOUT') {
            console.log('💡 请求超时，请检查网络连接');
        }
    }
}

testRequest();
