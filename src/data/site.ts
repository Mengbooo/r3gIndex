export const site = {
  name: 'r3actgo',
  monogram: 'r3g',
  url: 'https://r3actgo.com',
  title: 'r3actgo — Design, code & curiosity',
  description: 'Front-end development, design, creative coding, and experiments with AI. The personal website of r3actgo.',
  labs: 'https://labs.r3actgo.com',
  blog: 'https://blog.r3actgo.com',
} as const;

export const navigation = [
  { label: 'About', href: '#intro' },
  { label: 'Labs', href: site.labs },
  { label: 'Blog', href: site.blog },
  { label: 'Contact', href: '#contact' },
] as const;

export const contacts = [
  { label: 'email', value: 'r3actgo@163.com', href: 'mailto:r3actgo@163.com' },
  { label: 'github', value: 'https://github.com/Mengbooo', href: 'https://github.com/Mengbooo' },
  { label: 'X', value: '@R3actGo', href: 'https://x.com/R3actGo' },
  { label: 'rednote', value: 'r3actgo', href: 'https://www.xiaohongshu.com/user/profile/6025423800000000010094a0' },
] as const;

export const stickers = [
  { file: '01-r3g-wordmark', name: 'r3g wordmark' },
  { file: '06-smiling-flower', name: 'Smiling flower' },
  { file: '02-ascii-shark', name: 'ASCII shark' },
  { file: '03-terminal', name: 'Make things terminal' },
  { file: '07-ai-chip', name: 'Human + AI chip' },
] as const;
