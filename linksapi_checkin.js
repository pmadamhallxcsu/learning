/**
 * LinksAPI 自动签到脚本（呆呆面板/青龙面板）
 * 依赖：axios
 * 环境变量：
 * - LINKSAPI_COOKIE: 必填，从浏览器复制完整的 Cookie
 * - LINKSAPI_NEW_API_USER: 可选，New-Api-User 请求头值（如果需要）
 * - LINKSAPI_URL: 可选，默认为 https://api.linksapi.cn
 * - QYWX_KEY: 可选，企业微信机器人 Webhook Key
 *
 * 支持多账号，多个 Cookie 用 & 或换行分隔
 * cron: 0 9 * * *
 */

const axios = require('axios');

// 从环境变量读取配置
const COOKIE = process.env.LINKSAPI_COOKIE;
const BASE_URL = process.env.LINKSAPI_URL || 'https://api.linksapi.cn';
const NEW_API_USER = process.env.LINKSAPI_NEW_API_USER || ''; // New-Api-User 请求头
const QYWX_KEY = process.env.QYWX_KEY || ''; // 企业微信机器人 KEY

// 日志函数
function log(message, type = 'info') {
    const timestamp = new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' });
    const prefix = {
        'info': '📝',
        'success': '✅',
        'error': '❌',
        'warning': '⚠️'
    }[type] || '📝';
    console.log(`${prefix} [${timestamp}] ${message}`);
}

// 延迟函数
function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// ==================== 企业微信机器人通知 ====================
async function sendQYWXNotification(title, content) {
    if (!QYWX_KEY) {
        return; // 未配置则静默跳过
    }

    const url = `https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=${QYWX_KEY}`;

    const data = {
        msgtype: "text",
        text: {
            content: `【${title}】\n${content}\n时间：${new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}`
        }
    };

    try {
        const response = await axios.post(url, data, {
            headers: {
                'Content-Type': 'application/json'
            },
            timeout: 10000
        });

        if (response.data.errcode === 0) {
            log('企业微信通知发送成功', 'success');
        } else {
            log(`企业微信通知发送失败: ${response.data.errmsg}`, 'warning');
        }
    } catch (error) {
        log(`企业微信通知发送异常: ${error.message}`, 'warning');
    }
}

// 签到函数
async function checkin(cookie, index) {
    const accountName = `账号${index + 1}`;
    log(`开始处理 ${accountName}`, 'info');

    const result = {
        success: false,
        accountName: accountName,
        message: '',
        checkinDate: '',
        quotaAwarded: 0,
        checkinCount: 0,
        totalCheckins: 0,
        totalQuota: 0
    };

    try {
        // 提取必要的 Cookie 字段
        const sessionMatch = cookie.match(/session=([^;]+)/);
        const newApiUserMatch = cookie.match(/new-api-user=([^;]+)/);

        if (!sessionMatch) {
            log(`${accountName}: Cookie 格式错误，缺少 session 字段`, 'error');
            result.message = 'Cookie 格式错误';
            return result;
        }

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
            'cookie': cookie
        };

        // 优先使用环境变量中的 NEW_API_USER，其次从 Cookie 中提取
        if (NEW_API_USER) {
            headers['new-api-user'] = NEW_API_USER;
        } else if (newApiUserMatch) {
            headers['new-api-user'] = newApiUserMatch[1];
        }

        // 执行签到（接口1：POST 请求）
        log(`${accountName}: 正在执行签到...`, 'info');
        const checkinResponse = await axios.post(
            `${BASE_URL}/api/user/checkin`,
            {},
            {
                headers: headers,
                timeout: 15000
            }
        );

        if (checkinResponse.data.success) {
            const { checkin_date, quota_awarded } = checkinResponse.data.data;
            log(`${accountName}: ${checkinResponse.data.message}`, 'success');
            log(`${accountName}: 签到日期: ${checkin_date}`, 'info');
            log(`${accountName}: 获得额度: ${quota_awarded}`, 'info');

            result.success = true;
            result.message = checkinResponse.data.message;
            result.checkinDate = checkin_date;
            result.quotaAwarded = quota_awarded;

            // 等待1秒后查询签到记录（接口2：GET 请求）
            await delay(1000);

            const currentMonth = new Date().toISOString().slice(0, 7); // 格式: 2026-10
            log(`${accountName}: 正在查询本月签到记录...`, 'info');

            const statsResponse = await axios.get(
                `${BASE_URL}/api/user/checkin?month=${currentMonth}`,
                {
                    headers: headers,
                    timeout: 15000
                }
            );

            if (statsResponse.data.success) {
                const stats = statsResponse.data.data.stats;
                log(`${accountName}: 本月已签到 ${stats.checkin_count} 天`, 'info');
                log(`${accountName}: 累计签到 ${stats.total_checkins} 天`, 'info');
                log(`${accountName}: 累计获得额度: ${stats.total_quota}`, 'info');

                result.checkinCount = stats.checkin_count;
                result.totalCheckins = stats.total_checkins;
                result.totalQuota = stats.total_quota;

                return result;
            } else {
                log(`${accountName}: 查询签到记录失败`, 'warning');
                return result; // 签到成功但查询失败仍返回成功结果
            }
        } else {
            log(`${accountName}: 签到失败 - ${checkinResponse.data.message || '未知错误'}`, 'error');
            result.message = checkinResponse.data.message || '未知错误';
            return result;
        }
    } catch (error) {
        if (error.response) {
            const status = error.response.status;
            const message = error.response.data?.message || error.response.statusText;

            if (status === 401 || status === 403) {
                log(`${accountName}: 认证失败，请检查 Cookie 是否过期`, 'error');
                result.message = '认证失败，Cookie 已过期';
            } else if (status === 400 && message?.includes('已签到')) {
                log(`${accountName}: 今日已签到过`, 'warning');
                result.success = true;
                result.message = '今日已签到过';
                return result; // 已签到也算成功
            } else {
                log(`${accountName}: 请求失败 (${status}) - ${message}`, 'error');
                result.message = `请求失败: ${message}`;
            }
        } else if (error.request) {
            log(`${accountName}: 网络请求失败，请检查网络连接`, 'error');
            result.message = '网络请求失败';
        } else {
            log(`${accountName}: 发生错误 - ${error.message}`, 'error');
            result.message = error.message;
        }
        return result;
    }
}

// 主函数
async function main() {
    log('='.repeat(50), 'info');
    log('LinksAPI 自动签到脚本开始运行', 'info');
    log('='.repeat(50), 'info');

    // 检查环境变量
    if (!COOKIE) {
        log('未配置 LINKSAPI_COOKIE 环境变量', 'error');
        log('请在青龙面板中添加环境变量：LINKSAPI_COOKIE', 'error');
        return;
    }

    // 支持多账号：用 & 或换行符分隔
    const cookies = COOKIE.split(/[&\n]/).map(c => c.trim()).filter(c => c);

    if (cookies.length === 0) {
        log('Cookie 格式错误或为空', 'error');
        return;
    }

    log(`共检测到 ${cookies.length} 个账号`, 'info');
    log('-'.repeat(50), 'info');

    let successCount = 0;
    let failCount = 0;
    const results = []; // 存储所有账号的签到结果

    // 遍历所有账号执行签到
    for (let i = 0; i < cookies.length; i++) {
        const result = await checkin(cookies[i], i);
        results.push(result);

        if (result.success) {
            successCount++;
        } else {
            failCount++;
        }

        // 多账号之间延迟3秒
        if (i < cookies.length - 1) {
            log(`等待 3 秒后处理下一个账号...`, 'info');
            await delay(3000);
        }

        log('-'.repeat(50), 'info');
    }

    // 输出统计结果
    log('='.repeat(50), 'info');
    log('签到任务执行完成', 'info');
    log(`✅ 成功: ${successCount} 个账号`, 'success');
    log(`❌ 失败: ${failCount} 个账号`, failCount > 0 ? 'error' : 'info');
    log('='.repeat(50), 'info');

    // 发送企业微信通知
    if (QYWX_KEY) {
        let notificationContent = '';

        // 汇总所有账号的签到结果
        results.forEach((result, index) => {
            if (result.success) {
                notificationContent += `\n${result.accountName}: ✅ ${result.message}`;
                if (result.quotaAwarded > 0) {
                    notificationContent += `\n  • 获得额度: ${result.quotaAwarded}`;
                }
                if (result.checkinCount > 0) {
                    notificationContent += `\n  • 本月签到: ${result.checkinCount} 天`;
                }
                if (result.totalQuota > 0) {
                    notificationContent += `\n  • 累计额度: ${result.totalQuota}`;
                }
            } else {
                notificationContent += `\n${result.accountName}: ❌ ${result.message}`;
            }
        });

        notificationContent += `\n\n📊 统计信息:`;
        notificationContent += `\n  • 成功: ${successCount} 个`;
        notificationContent += `\n  • 失败: ${failCount} 个`;

        await sendQYWXNotification('LinksAPI 签到通知', notificationContent);
    }
}

// 执行主函数
main().catch(error => {
    log(`脚本执行出错: ${error.message}`, 'error');
    console.error(error);
});
