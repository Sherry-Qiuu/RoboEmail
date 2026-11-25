/**
 * Release notes shown in the update dialog. Add a new entry at the top for
 * every release and bump `version` in the root package.json — the web build and
 * the server both read that one field, so nothing can drift.
 */

export type Release = {
  version: string
  date: string
  items: string[]
}

export const CURRENT_VERSION = __APP_VERSION__

export const RELEASES: Release[] = [
  {
    version: '1.1.1',
    date: '2026-11-25',
    items: [
      '页面往下滚时，顶部的导航栏固定不动了',
      '写邮件页右上角加了「清空」，一键回到默认状态',
      '历史记录按邮件分组：一封邮件和它的每次润色收在一起，点开才展开',
      '学习页换成热力图，一眼看出这一年在哪几天改得多',
      '润色结果底部的「继续改」把改好的版本放回原文框，改一次点一次',
    ],
  },
  {
    version: '1.1.0',
    date: '2026-11-16',
    items: [
      '结果页多了一行「这次结果有用吗」，点一下就好',
      '页脚加了「反馈」，想说什么可以直接写',
      '反馈会带上页面和版本，方便定位问题',
    ],
  },
  {
    version: '1.0.0',
    date: '2026-11-16',
    items: [
      '写邮件：目的可多选，背景用中文写，出来就是英式成稿，附中文对照',
      '润色：英英润色，每处改动都有理由，真实语言错误单独列出',
      '调整方向：标签可多选，也能自由输入，第一次和后续每一轮都生效',
      '教授：576 人名录，463 份档案，含照片、研究方向和近期论文',
      '历史记录：留在本地，可导出 Word、PDF、HTML 或备份文件',
      '学习：改出来的错按类别归档，可标记已掌握',
      '账号：邮箱验证注册，用户名支持中文，忘记密码走邮件',
      '界面：支持深色模式与多种配色',
      '现在必须登录才能使用',
    ],
  },
]

export function latestRelease(): Release {
  return RELEASES[0] ?? { version: CURRENT_VERSION, date: '', items: [] }
}
