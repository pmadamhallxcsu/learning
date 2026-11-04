# LinksAPI 签到脚本 - 故障排查指南

## 快速诊断流程

### 步骤 1: 检查脚本文件

```bash
# 进入青龙容器
docker exec -it qinglong bash

# 查看脚本是否存在
ls -lh /ql/scripts/linksapi_checkin.js

# 查看脚本内容（前 20 行）
head -n 20 /ql/scripts/linksapi_checkin.js
```

**预期结果：** 文件存在且包含正确的 JavaScript 代码

---

### 步骤 2: 检查环境变量

```bash
# 在青龙容器中查看环境变量
cat /ql/config/env.sh | grep LINKSAPI

# 或者在青龙面板中查看
# 环境变量 -> 搜索 LINKSAPI
```

**预期结果：**
```bash
export LINKSAPI_COOKIE="session=xxxxx; new-api-user=xxxx"
export LINKSAPI_URL="https://api.linksapi.cn"  # 可选
export QYWX_KEY="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"  # 可选
```

---

### 步骤 3: 检查依赖

```bash
# 检查 Node.js 版本
node -v

# 检查 axios 是否安装
npm list -g axios

# 如果未安装，执行安装
npm install -g axios
```

**预期结果：** Node.js v14+ 且 axios 已安装

---

### 步骤 4: 手动测试执行

```bash
# 进入脚本目录
cd /ql/scripts

# 手动执行脚本
node linksapi_checkin.js
```

**观察输出，根据错误信息进一步排查**

---

## 常见错误及解决方案

### 错误 1: "不支持的解释器"

```
=== 执行失败 [2026-10-14 09:30:42] ===
不支持的解释器: pcweb/linksapi_checkin.js
```

**原因：**
- 任务命令格式错误
- 脚本路径不正确
- 脚本文件名或路径包含特殊字符

**解决方案：**

1. **修改任务命令**（按优先级尝试）：
   ```bash
   # 优先使用
   task linksapi_checkin.js
   
   # 或者
   node linksapi_checkin.js
   
   # 或者使用完整路径
   node /ql/scripts/linksapi_checkin.js
   ```

2. **检查文件位置**：
   ```bash
   # 确认文件在正确目录
   docker exec -it qinglong ls -la /ql/scripts/ | grep linksapi
   ```

3. **重新上传脚本**：
   - 删除现有脚本
   - 在 "脚本管理" 中重新创建
   - 确保文件名为 `linksapi_checkin.js`（不要有空格或特殊字符）

---

### 错误 2: "Cannot find module 'axios'"

```
Error: Cannot find module 'axios'
```

**原因：** 缺少 axios 依赖包

**解决方案：**

**方法 1：使用青龙面板（推荐）**
1. 进入 "依赖管理"
2. 点击 "新建依赖"
3. 类型选择：`nodejs`
4. 名称输入：`axios`
5. 点击确定，等待安装完成

**方法 2：命令行安装**
```bash
docker exec -it qinglong npm install -g axios
```

**方法 3：修改脚本使用内置模块**
如果无法安装 axios，可以修改脚本使用 Node.js 内置的 https 模块（需要重写请求部分）

---

### 错误 3: "Cookie 格式错误"

```
❌ [2026-10-14 09:00:00] 账号1: Cookie 格式错误，缺少 session 字段
```

**原因：** Cookie 不完整或格式错误

**解决方案：**

1. **重新获取 Cookie**：
   - 打开浏览器，登录 LinksAPI
   - 按 F12 打开开发者工具
   - 切换到 Network 标签
   - 点击签到按钮
   - 找到 `checkin` 请求
   - 复制完整的 `cookie` 请求头

2. **确保包含必要字段**：
   ```
   session=MTc5MTc2NzcyOXx...; new-api-user=3300
   ```
   至少需要包含 `session=` 字段

3. **检查环境变量中的 Cookie**：
   ```bash
   # 在青龙容器中
   cat /ql/config/env.sh | grep LINKSAPI_COOKIE
   ```

---

### 错误 4: "认证失败，Cookie 已过期"

```
❌ [2026-10-14 09:00:00] 账号1: 认证失败，请检查 Cookie 是否过期
```

**原因：** Cookie 已失效

**解决方案：**

1. 重新登录网站获取新的 Cookie
2. 更新青龙面板中的 `LINKSAPI_COOKIE` 环境变量
3. 重新运行任务测试

**延长 Cookie 有效期的技巧：**
- 在浏览器中勾选 "记住我" 选项登录
- 定期（如每周）更新一次 Cookie

---

### 错误 5: "网络请求失败"

```
❌ [2026-10-14 09:00:00] 账号1: 网络请求失败，请检查网络连接
```

**原因：**
- 青龙容器无法访问外网
- DNS 解析失败
- 目标网站被防火墙拦截

**解决方案：**

1. **测试网络连通性**：
   ```bash
   docker exec -it qinglong ping -c 3 api.linksapi.cn
   docker exec -it qinglong curl -I https://api.linksapi.cn
   ```

2. **检查 DNS**：
   ```bash
   docker exec -it qinglong cat /etc/resolv.conf
   # 如果 DNS 有问题，可以修改 docker-compose.yml 添加 DNS
   ```

3. **检查防火墙规则**：
   ```bash
   # 在宿主机上检查
   iptables -L -n | grep 443
   ```

4. **配置代理（如果需要）**：
   ```bash
   # 修改脚本，添加代理配置
   # 或在环境变量中设置
   export HTTP_PROXY=http://proxy.example.com:8080
   export HTTPS_PROXY=http://proxy.example.com:8080
   ```

---

### 错误 6: "企业微信通知发送失败"

```
❌ 企业微信通知发送失败: invalid webhook url, hint: [xxx], from ip: xxx
```

**原因：** Webhook Key 错误或机器人被删除

**解决方案：**

1. **检查 QYWX_KEY**：
   - 确认环境变量配置正确
   - Key 应为 UUID 格式：`xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`

2. **重新创建机器人**：
   - 在企业微信群中重新添加机器人
   - 获取新的 Webhook Key
   - 更新环境变量

3. **手动测试 Webhook**：
   ```bash
   curl -X POST "https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=你的KEY" \
     -H "Content-Type: application/json" \
     -d '{"msgtype":"text","text":{"content":"测试消息"}}'
   ```

4. **检查机器人限制**：
   - 企业微信机器人有频率限制（每分钟 20 次）
   - 检查是否超过限制

---

### 错误 7: "签到接口返回异常"

```
❌ [2026-10-14 09:00:00] 账号1: 请求失败 (500) - Internal Server Error
```

**原因：** 服务端问题

**解决方案：**

1. **检查网站状态**：
   - 直接访问网站确认是否正常
   - 尝试手动签到

2. **稍后重试**：
   - 可能是服务器临时故障
   - 等待 10-30 分钟后重试

3. **联系网站管理员**：
   - 如果持续失败，可能是网站 API 变更
   - 需要更新脚本适配新接口

---

## 调试技巧

### 1. 启用详细日志

修改脚本，添加更详细的调试信息：

```javascript
// 在 axios 请求前添加
console.log('请求 URL:', url);
console.log('请求头:', JSON.stringify(headers, null, 2));

// 在响应后添加
console.log('响应状态:', response.status);
console.log('响应数据:', JSON.stringify(response.data, null, 2));
```

### 2. 使用 curl 测试接口

```bash
# 测试签到接口
curl -X POST 'https://api.linksapi.cn/api/user/checkin' \
  -H 'cookie: session=你的session; new-api-user=你的userid' \
  -H 'content-type: application/json' \
  -v

# 测试查询接口
curl -X GET 'https://api.linksapi.cn/api/user/checkin?month=2026-10' \
  -H 'cookie: session=你的session; new-api-user=你的userid' \
  -v
```

### 3. 检查青龙日志

```bash
# 查看青龙系统日志
docker logs qinglong --tail 100

# 查看任务日志
docker exec -it qinglong cat /ql/log/你的任务名称_xxx.log
```

### 4. 监控脚本执行

```bash
# 实时查看日志
docker exec -it qinglong tail -f /ql/log/你的任务名称_xxx.log

# 或者在青龙面板中
# 定时任务 -> 找到任务 -> 点击"日志"按钮
```

---

## 完整测试流程

### 1. 环境检查清单

- [ ] 青龙面板版本：2.13+ 推荐
- [ ] Node.js 版本：v14+ 推荐
- [ ] axios 已安装
- [ ] 脚本文件存在于 `/ql/scripts/`
- [ ] 环境变量 `LINKSAPI_COOKIE` 已配置
- [ ] Cookie 格式正确且未过期
- [ ] 网络连接正常

### 2. 手动测试步骤

```bash
# 1. 进入容器
docker exec -it qinglong bash

# 2. 进入脚本目录
cd /ql/scripts

# 3. 检查环境变量
echo $LINKSAPI_COOKIE

# 4. 手动执行脚本
node linksapi_checkin.js

# 5. 查看输出，确认签到成功

# 6. 如果成功，添加到定时任务
```

### 3. 定时任务配置验证

- [ ] 任务名称已设置
- [ ] 命令格式正确（推荐 `task linksapi_checkin.js`）
- [ ] cron 表达式正确（如 `0 9 * * *`）
- [ ] 任务已启用（状态为运行中）
- [ ] 手动运行测试成功

---

## 获取帮助

如果以上方法都无法解决问题，请收集以下信息寻求帮助：

1. **环境信息**：
   ```bash
   docker --version
   docker exec -it qinglong node -v
   docker exec -it qinglong npm list -g axios
   ```

2. **完整错误日志**：
   - 青龙任务日志（脱敏后）
   - 手动执行的完整输出

3. **配置信息**（脱敏）：
   - 任务命令
   - cron 表达式
   - Cookie 格式（仅保留字段名，不要提供实际值）

4. **测试结果**：
   - 手动执行是否成功
   - curl 测试接口是否正常
   - 浏览器手动签到是否成功

---

**最后更新：** 2026-10-14
