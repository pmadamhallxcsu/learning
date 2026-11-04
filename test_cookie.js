/**
 * 快速测试 Cookie 有效性
 */

const axios = require('axios');

// 从命令行参数读取
const sessionValue = process.argv[2];

if (!sessionValue) {
    console.error('请提供 session 值');
    console.log('使用方法: node test_cookie.js "session值"');
    process.exit(1);
}

const COOKIE = `session=${sessionValue}`;
const BASE_URL = 'https://api.linksapi.cn';

console.log('🔍 测试 Cookie 有效性...');
console.log('Session 长度:', sessionValue.length);
console.log('');

async function test() {
    const headers = {
        'accept': 'application/json, text/plain, */*',
        'accept-language': 'zh-CN,zh;q=0.9,en;q=0.8',
        'cache-control': 'no-store',
        'origin': BASE_URL,
        'referer': `${BASE_URL}/profile`,
        'sec-ch-ua': '"Microsoft Edge";v="155", "Chromium";v="155", "Not(A:Brand";v="24"',
        'sec-ch-ua-mobile': '?0',
        'sec-ch-ua-platform': '"Windows"',
        'sec-fetch-dest': 'empty',
        'sec-fetch-mode': 'cors',
        'sec-fetch-site': 'same-origin',
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36 Edg/155.0.0.0',
        'cookie': COOKIE
    };

    try {
        console.log('📡 发送签到请求...');
        const response = await axios.post(
            `${BASE_URL}/api/user/checkin`,
            {},
            {
                headers: headers,
                timeout: 15000,
                validateStatus: () => true
            }
        );

        console.log('');
        console.log('========== 响应结果 ==========');
        console.log('HTTP 状态码:', response.status);
        console.log('响应数据:', JSON.stringify(response.data, null, 2));
        console.log('');

        if (response.status === 401 || response.status === 403) {
            console.error('❌ 认证失败！');
            console.log('');
            console.log('💡 可能的原因:');
            console.log('1. Cookie 已过期 - 需要重新登录获取');
            console.log('2. Cookie 不完整 - 可能缺少其他必要字段');
            console.log('3. 服务器要求更多认证信息（如 new-api-user）');
            console.log('');
            console.log('🔧 请尝试:');
            console.log('1. 打开浏览器隐私模式，访问', BASE_URL);
            console.log('2. 登录账号');
            console.log('3. F12 打开开发者工具 → Network');
            console.log('4. 刷新页面，点击任意 API 请求');
            console.log('5. 查看 Request Headers，复制完整的 Cookie');
            console.log('6. 检查是否包含多个字段（session, new-api-user 等）');
        } else if (response.status === 200) {
            if (response.data.success) {
                console.log('✅ Cookie 有效！签到成功！');
            } else if (response.data.message?.includes('已签到')) {
                console.log('✅ Cookie 有效！今日已签到过');
            } else {
                console.log('⚠️  Cookie 可能有效，但签到失败:', response.data.message);
            }
        } else {
            console.log('⚠️  收到异常响应，状态码:', response.status);
        }

    } catch (error) {
        console.error('❌ 请求异常:', error.message);
        if (error.response) {
            console.log('响应数据:', error.response.data);
        }
    }
}

test();
