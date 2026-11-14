<div align="center">
  <img src="docs/preview/logo-lockup.png" alt="Mango-Mail" width="360" />
  <p><b>域名邮箱</b> · Cloudflare Workers · 全栈 TypeScript</p>
</div>

一个跑在 Cloudflare Workers 上的邮箱分发系统：收信（Email Routing）+ 发信（多服务商可插拔）+ 账号分发（邀请码 / 批量开户）+ 规则分发（Telegram / Webhook / 外部邮箱转发）。

参考设计：[Cloud Mail](https://github.com/maillab/cloud-mail) / [doc.skymail.ink](https://doc.skymail.ink/) / [henna](https://github.com/wcvjk8tnz8-create/henna)。本项目为独立实现，全栈 TypeScript。

全免费额度可跑：Workers Free + D1 + KV + R2（R2 可选）+ Resend 免费版（每月 3000 封）。

部署完成后的面板：

![部署完成后的面板](docs/images/hero-panel.png)

## 能做什么

- 用自己的域名收信、发信
- 多个邮箱地址，邀请码开户
- 发信服务商可换：Resend / SendGrid / Mailgun / Brevo / Postmark / Cloudflare Email Service，失败自动切换
- 分发规则：Telegram / Webhook / 转发到外部邮箱
- 管理员后台：用户与统计、发信日志、分析

## 部署前准备

- 一个 Cloudflare 账号（免费版就行），一个已经托管在 Cloudflare 的域名
- 一个 GitHub 账号
- 一个 Resend 账号（resend.com，免费版每月 3000 封）
- 绑定和变量分开放：绑定靠构建变量填进 `worker/wrangler.jsonc` 的占位符，变量只在面板里填（原因见第 2、4、5 步）
- 全程不用写代码，不用在本地装 Git

> 本教程用的是 **Workers Builds（Cloudflare 面板直连 Git）** 部署，push 代码即自动部署。仓库里旧的 GitHub Actions 方式已停用。

---

## 部署教程

### 第 1 步：Fork 本项目

打开本仓库，右上角点 **Fork**，顺手点一颗 Star。

后面部署时选的是你自己 Fork 出来的仓库（`你的用户名/mango-mail`），不是原作者的。

### 第 2 步：新建 3 个资源

**D1 数据库**：Cloudflare 控制台 → Workers & Pages → D1 → Create database，名字填 `mango-mail-db`。

![创建 D1 数据库](docs/images/step2-create-d1.png)

**KV 命名空间**：Workers & Pages → KV → Create a namespace，名字填 `mango-mail-kv`。

![创建 KV 命名空间](docs/images/step2-create-kv.png)

> 名字只填 `mango-mail-kv`，不要多打别的字。

**R2 存储桶**：R2 → Create bucket，名字填 `mango-mail-r2`。

![创建 R2 存储桶](docs/images/step2-create-r2.png)

> R2 是唯一可选的资源：免费额度需要绑卡，不想绑卡可以先不建。没有 R2 也能正常部署，收到的邮件附件只登记文件名与大小、不保存内容，收信、发信、规则分发全部照常工作。以后想开附件存储，随时建桶再绑定就行。

**把 ID 填进构建变量（第一次部署前必须做）**：点进刚建的 D1 数据库详情页，复制「数据库 ID」；点进 KV 命名空间，复制「命名空间 ID」。然后去 Workers → `mango-mail` → 设置 → **构建** → **变量和机密**，点「添加变量」，加下面两个（都选**机密**，值在构建日志里会被打码）：

| 名字 | 值 |
| --- | --- |
| `D1_ID` | 刚复制的 D1 数据库 ID |
| `KV_ID` | 刚复制的 KV 命名空间 ID |

> 为什么要用构建变量：部署时 `wrangler deploy` 会把 Worker 的配置同步成配置文件里的样子，配置文件里没写的绑定会被删掉。只在面板里绑，下次更新代码就没了，登录会报 `internal error`，得重绑。所以 `worker/wrangler.jsonc` 里已经写好了三个绑定的位置，但 D1 / KV 的 ID 只留了占位符（`REPLACE_D1_DATABASE_ID` / `REPLACE_KV_NAMESPACE_ID`），不写真实 ID——仓库是公开的，真实 ID 写进去就公开了，别人 Fork 后也会拿到你的 ID。部署时，部署命令会先跑 `scripts/render-build-config.mjs`，把占位符换成构建变量里的值再部署，绑定每次都会自动重新加上。R2 只要桶名，已经直接写在配置文件里，不用变量。没建 R2 的话，把 `worker/wrangler.jsonc` 里 `r2_buckets` 那段删掉再部署（附件功能会降级，只登记文件名和大小）。以后别人 Fork 这个项目，填自己的两个构建变量就能部署。

### 第 3 步：建 Worker，连 Git（Workers Builds）

Workers & Pages → **创建应用程序** → **Import a Git repository**（导入 Git 仓库）。

![Workers 和 Pages](docs/images/step3-workers-pages.png)

点 **Connect GitHub**，授权后选择你第 1 步 Fork 的仓库（`你的用户名/mango-mail`），分支选 `main`。

![Connect GitHub](docs/images/step3-create-connect-github.png)

![选择仓库](docs/images/step3-select-repo.png)

按下表填写，其余留默认：

| 项 | 填什么 |
| --- | --- |
| 项目名称 | `mango-mail` |
| 构建命令 | `npm run build` |
| 部署命令 | `npm run deploy:builds` |
| 预览命令 | `npx wrangler preview`（不动，留默认） |
| 根目录 | `/`（仓库根目录） |

![构建与部署命令](docs/images/step3-build-settings.png)

> 点部署之前，确认第 2 步的两个构建变量已经加好了，否则部署会报错，绑定是空的，登录会报 `internal error`。

点部署，等构建跑完。全部打勾、显示**已自动部署**就是成功了，记下 Worker 地址（形如 `https://mango-mail.<你的子域>.workers.dev/`）。

![构建成功](docs/images/step3-build-success.png)

### 第 4 步：检查绑定（部署后）

部署完去 Workers → `mango-mail` → 设置 → **绑定**，确认三个绑定都在：

| 绑定类型 | 变量名称 | 选哪个 |
| --- | --- | --- |
| D1 数据库 | `DB` | `mango-mail-db` |
| KV 命名空间 | `KV` | `mango-mail-kv` |
| R2 存储桶 | `R2` | `mango-mail-r2` |

![绑定列表](docs/images/step4-bindings.png)

> 绑定是部署时用第 2 步的构建变量填进配置文件的，部署时自动加上，面板里只是查看。如果这里是空的，说明构建变量没填或填错了，回去检查再部署一次。**不要只在面板里点「添加绑定」**，那样下次更新代码时会被删掉。

### 添加id  先复制创建的kv 、d1 的id值
在项目中进行绑定 Worker 面板 → 设置 → 构建 → 变量和机密里，加自己的 D1_ID、KV_ID（都选机密）

<img width="1035" height="183" alt="69b0f7e4f748bb65c6fedb4d9a8141d9" src="https://github.com/user-attachments/assets/c8aee919-119a-4a9e-b742-ce95757875e9" />

<img width="809" height="537" alt="dfd7c979300fddce1c77f75cc9f8a09c" src="https://github.com/user-attachments/assets/3b047d86-03db-4ae2-9305-800046f6bef4" />


#### 定时任务（Cron 触发器）

当前版本的 `worker/wrangler.jsonc` 里没有 `triggers`（为了避开免费账号 5 个触发器上限报 `10072`），所以部署后 Triggers 里是空的，定时日清不跑。

它每天做 3 件事，作用是“每日维护：重置配额与用量、清理过期日志”，触发时间 `"0 16 * * *"`，也就是每天 UTC 16:00，北京时间午夜 0 点跑一次：

1. 用户发信计数清零：`UPDATE user SET used = 0`，把所有用户的当天已发数清零
2. 服务商日用量清零：`UPDATE mail_provider SET daily_used = 0`，把每个发信服务商的当天已用量清零
3. 删 90 天前的发信日志：`DELETE FROM mail_log WHERE created_at < 90天前`，只删日志，不删邮件本身

去掉之后有什么影响：主要是第 1 条。发信的时候，每发一封 `used` 就 +1，`used` 到了配额（默认 50 封）就报 429“发信配额不足”，发不出去。以前每天午夜清零，第二天又能发 50 封；现在不跑了，`used` 只加不减，累计发满 50 封之后就一直发不出去，得手动去 D1 里跑 `UPDATE user SET used = 0` 才能恢复。第 2 条影响不大，只是服务商的日用量统计会一直累计。第 3 条影响也不大，只是 `mail_log` 表会越长越大，D1 慢慢变大。

所以**收信完全不受影响**，发信在 50 封以内也完全正常。这个数字限制可以在变量（`DEFAULT_QUOTA`）中更改。

如果你账号还有空闲的触发器名额，把下面这段加回 `worker/wrangler.jsonc` 再部署一次，Triggers 里就会多一条每天 16:00（UTC）运行的任务：

```jsonc
"triggers": { "crons": ["0 16 * * *"] }
```

> 免费账号一个账号最多 5 个 Cron 触发器。如果部署时报 `10072`，就是触发器满了：去别的 Worker 上删一条不用的 Cron 再重新部署；或者删掉 `worker/wrangler.jsonc` 里的 `triggers` 再部署（代价就是上面说的配额不清零）。

### 第 5 步：变量说明、设置

![运行变量和机密](docs/images/step5-variables.png)

变量只在面板里设置：Workers → `mango-mail` → 设置 → **变量**，点铅笔改，改完立即生效。**不要把变量写进 `worker/wrangler.jsonc` 的 `vars`**——写进去的话，每次部署都会用配置文件里的值盖掉面板里的值（`keep_vars: true` 只保住配置文件里没提到的变量）。

![变量说明表](docs/images/step5-variables-table.png)

| 变量 | 面板里填什么 | 意思 | 说明 |
| --- | --- | --- | --- |
| `APP_NAME` | `Mango-Mail` | 面板显示名，左栏、登录页、网页标题用 | 面板名称 |
| `ADMIN_EMAIL` | `admin@你的域名` | 管理员邮箱，创建账号默认的邮箱 | 域名必须在 `MAIL_DOMAINS` 里 |
| `MAIL_DOMAINS` | `["你的域名"]` | 这个邮箱系统管哪几个域名，JSON 数组格式 | 单个 `["example01.com"]`，多个 `["example01.com","example02.com"]` |
| `ALLOW_REGISTER` | `true` | 允许公开注册码？`true` 是谁都能注册，`false` 是只能用邀请码注册 | 值：`false` 就关闭公开注册 |
| `DEFAULT_QUOTA` | `50` | 每个用户每天能发几封，默认 50 | 值随意，新注册的用户按新值算 |
| `PROVIDER_STRATEGY` | `priority` | `priority` 是按权重顺序试，失败自动换下一个；`round_robin` 是轮流用 | 一般 `priority` 就行 |

`JWT_SECRET` 不在这张表里，它是机密，要手动加：**添加变量 → 添加机密**，名字填 `JWT_SECRET`，值随便打一个别人猜不到的字符串，不能含 `? % # / \ | &`。

![添加 JWT_SECRET 机密](docs/images/step5-jwt-secret.png)

> 注意两点：部署后别改 `JWT_SECRET`，改了会让所有已登录用户被迫重新登录；它同时是第 6 步初始化接口的口令，所以别泄露。

### 第 6 步：初始化建表

打开下面链接（把两处换成你自己的）：

```
https://<你的 Worker 地址>/api/init/<你刚设的 JWT_SECRET>
```

看到 `success` 就说明 **D1 的表建好了**。

![初始化成功](docs/images/step6-init-success.png)

为什么要这一步：新建的 D1 数据库是空的，没有 `user`、`mail_message` 这些表，不初始化就注册会报 `internal error`。初始化只需要跑一次，可以重复跑，不会丢数据。

### 第 7 步：注册账号

打开 Worker 地址，点**创建账号**，用 `ADMIN_EMAIL` 那个邮箱注册，密码自己定（至少 6 位）。

![登录 / 注册页](docs/images/step7-login.png)

第一个注册的用户自动成为管理员；邮箱前缀是 `admin` 的账号（如 `admin@…`）永远是管理员，后台降不了级。

![注册成功后的收件箱](docs/images/step7-inbox-empty.png)

### 第 8 步：启用邮件接收

收信靠 Cloudflare（Email Routing），发信靠 Resend（第 9 步），两个分开配。

1. 回到 Cloudflare 控制台，点击菜单账户主页，再点你的域名。
2. 左边 **电子邮件 → 电子邮件路由**，点**开始使用**。

![电子邮件路由](docs/images/step8-email-routing-start.png)

3. 按入站指南把 MX / TXT（SPF、DKIM）记录加上。向导让你填自定义地址时，直接点**跳过**，什么都不用填。

![入站指南，直接点跳过](docs/images/step8-routing-wizard-skip.png)

![启用电子邮件路由](docs/images/step8-routing-overview.png)

![添加 DNS 记录](docs/images/step8-add-dns-records.png)

4. **路由规则 → Catch-all → 编辑**：操作选**发送到 Worker**，目标选 **`mango-mail`**，保存。

![Catch-all 规则](docs/images/step8-catch-all-list.png)

![编辑 Catch-all，目标选 mango-mail](docs/images/step8-catch-all-edit.png)

5. 回到**电子邮件 Workers** 看一眼，Catch-All 显示**活动**就是成功了。

![电子邮件 Workers，Catch-All 活动](docs/images/step8-email-workers.png)

> ⚠️ 一个域名的 Catch-all 同一时间只能指向一个 Worker。上面截图里的目标是 `cfemail`，那是另一个项目（cloud-mail）的 Worker，这里只是借它的界面做演示；**给 mango-mail 收信，目标必须选 `mango-mail`**，否则信会进别的项目，mango-mail 收不到。
>
> 启用后从别的邮箱往你的域名邮箱发一封测试信，面板收件箱里能看到就是通了。

### 第 9 步：配置发信（Resend）

浏览器打开 resend.com 注册账号。

1. 左边 **Domains → Add domain**，输入不带前缀的域名（比如 `151819.xyz`），Region 选离自己近的（Tokyo），点 **Add Domain**。

![Resend 添加域名](docs/images/step9-resend-domains.png)

![输入域名，选 Tokyo](docs/images/step9-resend-add-domain.png)

2. 点 **Sign in to Cloudflare**，授权 Resend 自动加 DNS 记录（DKIM、MX、SPF）；也可以点 Manual setup 自己加。

![Sign in to Cloudflare 自动解析](docs/images/step9-resend-sign-in-cloudflare.png)

![授权 Resend 添加 DNS 记录](docs/images/step9-resend-authorize-dns.png)

3. 等域名状态变成**已验证**（Verified）。DNS 记录一般几分钟生效。

![等待 DNS 记录验证](docs/images/step9-resend-dns-records.png)

![域名已验证](docs/images/step9-resend-domain-verified.png)

![验证通过](docs/images/step9-resend-domain-verified-2.png)

4. 左边 **API Keys → Create API key**：名字随意，Permission 选 **Full access**，Domain 选 **All Domains**，点 Add。

![API Keys](docs/images/step9-resend-api-keys.png)

![创建 API Key](docs/images/step9-resend-create-api-key.png)

5. 弹出的 Key **只显示一次**，复制保存好。

![只显示一次，复制保存好](docs/images/step9-resend-view-api-key.png)

6. 回到 Mango-Mail 面板 → **站点管理 → 发信服务商 → 添加服务商**：类型选 **Resend**，备注名称填你的邮箱，API Key 粘贴刚才复制的，保存。

![面板里添加 Resend 服务商](docs/images/step9-panel-add-resend.png)

7. 把 **Noop 自测通道停用**。它是假的，不真发信；留着启用会抢走流量。

![停用 Noop 自测通道](docs/images/step9-panel-noop-provider.png)

验证：写信页给自己别的邮箱发一封，能收到就是通了。Resend 免费版每月 3000 封。

---

## 部署后检查清单

- [ ] 打开 Worker 地址能注册、登录
- [ ] `/api/init/<JWT_SECRET>` 显示 `success`
- [ ] 从外部邮箱发一封到你的域名邮箱，面板收件箱能收到
- [ ] 从面板发一封到外部邮箱，能收到
- [ ] 设置 → 绑定里有 DB / KV / R2 三个绑定
- [ ] 设置 → 变量里的 `MAIL_DOMAINS` 是你的域名（不是 `example.com`）
- [ ] （可选）设置 → Triggers 里有一条每天 16:00 的 Cron（把 `triggers` 加回配置文件才有）

## 常见问题

- **登录/注册报 `internal error`**：先去设置 → 绑定看 DB 绑定在不在，不在就是部署时被删了（见第 4 步），检查第 2 步的构建变量填没填对再部署；绑定在的话，再跑第 6 步 `/api/init`。
- **发信报 429“发信配额不足”**：当天发满 `DEFAULT_QUOTA` 封了；等午夜 Cron 清零，或去 D1 跑 `UPDATE user SET used = 0`，或把 `DEFAULT_QUOTA` 调大（`-1` 为不限）。
- **部署报 `10072`**：账号 Cron 触发器满 5 个了，见第 4 步。
- **收不到信**：检查 Email Routing 的 Catch-all 目标是不是 `mango-mail`；MX / SPF / DKIM 是不是绿色；`MAIL_DOMAINS` 里有没有你的域名。
- **发不出去 / 进垃圾箱**：检查 Resend 域名是不是已验证；面板里 Resend 通道是不是启用、Noop 是不是已停用。
- **不想绑卡用 R2**：R2 是唯一可选的，不绑也能部署；附件只登记文件名与大小，不保存内容，收发信照常。
- **一个域名能用在两个域名邮箱项目上吗**：收信不行，Catch-all 一次只能指向一个 Worker；发信可以，两个项目都能用同一个域名发（SPF / DKIM 对上就行）。

## 本地开发

```bash
cd worker && npm i && npm run d1:local   # 本地 SQLite 建表
cd worker && npm run dev                 # http://localhost:8787

cd web    && npm i && npm run dev        # http://localhost:5173（代理 /api 到 8787）
```

首次注册的用户自动成为 `admin`。本地只能看界面，Email Routing 收信和真发信要在 Cloudflare 上才行。

## 开放 API

所有 `/api/*` 均可用 `Authorization: Bearer <jwt>` 或 `X-Api-Key: <key>` 调用：

```bash
curl -X POST https://<你的域名>/api/send \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"from":"a@你的域名","to":["b@example.com"],"subject":"hi","html":"<b>hi</b>"}'
```

## License

MIT
