# 🚀 部署到云服务器（关电脑后手机也能打开）

本系统是**零依赖 Node 应用**，部署很简单。核心思路：

> 把 `multi/` 放到一台 **7×24 小时在线的云服务器** 上运行，再用 **PM2** 保活、**域名 + HTTPS** 供手机/微信访问、**定时任务**自动更新开奖数据。
> 之后你自己的电脑关机与否都不影响。

---

## 一、准备一台云服务器（推荐国内）

- 阿里云 / 腾讯云 **轻量应用服务器**，系统选 **Ubuntu 22.04 / 20.04**（或 CentOS）。
- 建议地域选国内（上海/北京等），这样访问体彩/福彩官方接口最稳、微信/手机访问快。
- 最低配置 2 核 2G 即可，带宽 3~5M 足够。
- 控制台「安全组 / 防火墙」放行端口：`22`(SSH)、`80`、`443`（如果只用 IP+端口测试，则放行 `8790`）。

---

## 二、把代码传到服务器

### 方式 A：整站打包上传（最简单）
在你电脑上打包：
```bash
cd ~/Documents/ChatGPT/个人主页
tar -czf multi-deploy.tgz multi/          # 只打包 multi 子系统（含 data/all.json）
```
用 `scp` 传到服务器：
```bash
scp multi-deploy.tgz root@你的服务器IP:/root/
```
服务器上解压：
```bash
ssh root@你的服务器IP
mkdir -p /opt/lottery && cd /opt/lottery
tar -xzf /root/multi-deploy.tgz
cd multi
```

### 方式 B：Git 仓库（以后更新方便）
在 GitHub / Gitee 建私有仓库，把项目 push 上去，服务器上：
```bash
cd /opt && git clone 你的仓库地址 lottery
cd lottery/multi
```
> 注：`multi/data/all.json` 已被 `.gitignore` 忽略，不会入库。服务器首次运行前先抓一次数据：
> ```bash
> node scripts/fetch.js        # 从体彩/福彩官方接口抓取全部历史（约需几分钟）
> ```

---

## 三、服务器安装 Node.js（≥18）

```bash
# Ubuntu 用 NodeSource 安装 Node 20 LTS
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
node -v      # 应显示 v20.x 以上
```

---

## 四、启动并“常驻运行”（关 SSH 也不掉）

推荐用 **PM2**：

```bash
sudo npm i -g pm2
cd /opt/lottery/multi
node scripts/fetch.js          # 首次：抓取/生成 data/all.json（已有可跳过）
pm2 start server.js --name lottery
pm2 save                       # 记住进程列表
pm2 startup                    # 开机自启（按提示执行它输出的一行命令）
```

常用命令：
```bash
pm2 status            # 查看运行状态
pm2 logs lottery      # 看日志
pm2 restart lottery   # 重启
pm2 stop lottery      # 停止
```

> 不用 PM2 也可以：`nohup node server.js > app.log 2>&1 &`，但不如 PM2 好管理。
> 如用 systemd 常驻，把 `server.js` 配成服务即可（PM2 已够用）。

---

## 五、让手机/微信直接访问（域名 + HTTPS）

现在可以用 `http://服务器IP:8790` 访问了，但**微信内置浏览器可能拦截非备案/非 80/443 页面**，所以正式给手机用，建议配域名 + HTTPS：

1. 买一个域名并完成 **ICP 备案**（国内服务器必须备案，微信才能直接打开）。
2. 域名解析：`A 记录` → 你的服务器 IP。
3. 装 Nginx 反向代理 + 免费 HTTPS（Let's Encrypt）：

```bash
sudo apt-get install -y nginx certbot python3-certbot-nginx

# 反向代理配置 /etc/nginx/sites-available/lottery
# server_name 你的域名.com;
# location / { proxy_pass http://127.0.0.1:8790; proxy_set_header Host $host; }

sudo certbot --nginx -d 你的域名.com     # 自动签发并配置 HTTPS
```

完成后手机/微信直接访问：`https://你的域名.com`

> 若只自己用、不想备案，可用国内大厂的「内网穿透/Web 部署」服务（如 腾讯云托管、阿里云函数计算）或境外服务器 + 域名，但境外访问国内官方数据接口可能变慢/不稳，不推荐用于本工具。

---

## 六、自动更新开奖数据（定时任务）

体彩/福彩每晚开奖，建议每天定时把数据刷到最新：

```bash
crontab -e
# 每天 09:15 刷新全部官方数据（此时前一日所有彩种基本都已开完）
15 9 * * * cd /opt/lottery/multi && /usr/bin/node scripts/fetch.js >> /opt/lottery/multi/cron.log 2>&1
```

> 说明：`scripts/fetch.js` 会**全量**抓取（保证准确、可去重），每次约 5~10 分钟，每天一次完全没问题。
> 只想刷单个游戏时，也可用接口：`curl 'http://127.0.0.1:8790/api/refresh?game=ssq'`（game 可换 dlt/qxc/pl3/pl5/kl8/f3d）。

---

## 七、上线检查清单

- [ ] `pm2 status` 显示 `online`
- [ ] 本机访问 `http://127.0.0.1:8790` 正常
- [ ] 手机浏览器访问 `http://服务器IP:8790`（或域名）正常
- [ ] 微信能打开（需域名 + HTTPS + 备案）
- [ ] 定时任务每天自动刷新数据
- [ ] 页面含“理性购彩”提示，不对外承诺中奖（合规）

---

## ⚠️ 合规与安全提示

- 本工具定位为**个人统计参考工具**，请勿以“预测/必中”名义对外宣传或收费荐彩，以免违反《彩票管理条例》及相关法规。
- 服务器对外暴露时，`/api/refresh` 等接口任何人都能调用，可能被刷。介意的话：
  - 只开放给家人/朋友：Nginx 加 `allow/deny` IP；
  - 或给页面加一个简单访问口令（需要可帮你加）。
