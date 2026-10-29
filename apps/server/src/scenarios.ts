export type PurposeId =
  | 'inquiry'
  | 'request'
  | 'extension'
  | 'meeting'
  | 'apology'
  | 'thanks'
  | 'complaint'
  | 'application'
  | 'other'

export type Purpose = {
  id: PurposeId
  label: string
  hint: string
  brief: string
}

/**
 * `brief` goes straight into the prompt. It says what the email has to
 * accomplish, not how to phrase it — phrasing is the model's job.
 */
export const PURPOSES: Purpose[] = [
  {
    id: 'inquiry',
    label: '询问信息',
    hint: '确认一个信息，或问清流程',
    brief:
      'Get one specific piece of information. Show what the sender already checked, so the question does not read as lazy.',
  },
  {
    id: 'request',
    label: '请求帮忙',
    hint: '希望对方做一件事',
    brief:
      'Ask the recipient to do something concrete. Make the ask easy to act on and leave them a comfortable way to decline.',
  },
  {
    id: 'extension',
    label: '请假与延期',
    hint: '作业、考试或出勤',
    brief:
      'Ask for an extension or an absence. State the reason in one line without over-explaining, and say what the sender will do about it.',
  },
  {
    id: 'meeting',
    label: '约时间',
    hint: '见面、答疑、office hour',
    brief:
      'Propose a meeting. Offer two concrete time windows rather than asking the recipient to invent one.',
  },
  {
    id: 'apology',
    label: '道歉',
    hint: '迟到、错过、失误',
    brief:
      'Apologise once, plainly, then move to what happens next. No repeated apologising.',
  },
  {
    id: 'thanks',
    label: '感谢',
    hint: '道谢或确认收到',
    brief: 'Thank the recipient for something specific. Short and warm, not effusive.',
  },
  {
    id: 'complaint',
    label: '投诉反馈',
    hint: '对课程、服务或流程有意见',
    brief:
      'State the problem factually, then its impact, then a proposed fix. Stay measured; no blame.',
  },
  {
    id: 'application',
    label: '申请与套磁',
    hint: '项目、奖学金、研究机会',
    brief:
      'Introduce the sender in two lines, connect their background to the recipient’s work, and ask one clear question.',
  },
  {
    id: 'other',
    label: '其他',
    hint: '上面都不像',
    brief: 'Work out what the sender actually needs and structure the email around that need.',
  },
]

export function findPurpose(id: string): Purpose {
  return PURPOSES.find((purpose) => purpose.id === id) ?? PURPOSES[PURPOSES.length - 1]!
}
