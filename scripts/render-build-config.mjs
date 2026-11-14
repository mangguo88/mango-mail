#!/usr/bin/env node
/**
 * Workers Builds 部署用：把构建变量里的资源 ID 填进 wrangler.jsonc 的占位符，
 * 生成 worker/wrangler-deploy.jsonc（不进仓库），再用它部署。
 *
 * 仓库里的 wrangler.jsonc 只留占位符，不含真实 ID：
 *   - 别人 Fork 后，在自己的 Cloudflare 面板填自己的构建变量就能部署；
 *   - 部署时配置里始终有真实绑定，面板里的绑定也不会再被删掉。
 *
 * 构建变量在 Cloudflare 面板设置：
 *   Workers → mango-mail → Settings → Builds → Variables and secrets
 *     D1_ID（机密）：D1 数据库 ID
 *     KV_ID（机密）：KV 命名空间 ID
 * R2 只要桶名，直接写在 wrangler.jsonc 里，不用变量。
 * 本地部署时，在命令前面加上 D1_ID=... KV_ID=... 再跑 npm run deploy:builds。
 *
 * 注意：这里只替换 ID，不打印 ID、不碰变量。
 * 变量（MAIL_DOMAINS 等）只在面板 Settings → Variables 里填，部署时不碰它们。
 */
import fs from 'node:fs';
import path from 'node:path';

const src = path.resolve('worker/wrangler.jsonc');
const out = path.resolve('worker/wrangler-deploy.jsonc');
let text = fs.readFileSync(src, 'utf8');

const missing = [];
for (const [key, placeholder] of [
  ['D1_ID', 'REPLACE_D1_DATABASE_ID'],
  ['KV_ID', 'REPLACE_KV_NAMESPACE_ID'],
]) {
  const v = process.env[key];
  if (!v) {
    missing.push(key);
    continue;
  }
  if (!text.includes(placeholder)) {
    console.error(`✗ wrangler.jsonc 里找不到占位符 ${placeholder}`);
    process.exit(1);
  }
  text = text.replaceAll(placeholder, v);
}

if (missing.length) {
  console.error(`✗ 缺少构建变量：${missing.join('、')}。`);
  console.error('  在 Cloudflare 面板设置：Workers → mango-mail → Settings → Builds → Variables and secrets，');
  console.error('  D1_ID 填 D1 数据库 ID，KV_ID 填 KV 命名空间 ID（都设成机密）。');
  console.error('  本地部署时，在命令前面加上 D1_ID=... KV_ID=... 再跑。');
  process.exit(1);
}
if (text.includes('REPLACE_')) {
  console.error('✗ 仍有未替换的占位符，请检查 wrangler.jsonc');
  process.exit(1);
}

fs.writeFileSync(out, text);
console.log('✓ 已生成 worker/wrangler-deploy.jsonc（绑定来自构建变量）');
