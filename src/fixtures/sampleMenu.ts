/** Soulver 手机截图点菜示例 — menu lines total 594 */
export const MENU_ONLY = `蒸蒸日上 128
重庆毛血旺 58
锅边馍 小 15
水煮牛肉 198
开胃泡菜 39
干拌红油抄手 48
红酱凉粉 22
米饭 18
酸梅汤 68`

export const SAMPLE_MENU = `${MENU_ONLY}

// 下面变量默认不计总？可用 ! 排除
!人天单价 = 1200
!天数 = 5
!差旅 = 2000
!人天单价 * 天数 + 差旅
`

export const QUOTE_SAMPLE = `// 报价试算
!人天单价 = 1200
!天数 = 10
!税率 = 0.06
人天小计 = 人天单价 * 天数
税费 = 人天小计 * 税率
差旅 = 3500
人天小计 + 税费 + 差旅

// 满减演示
商品 = 580
商品 满300减50
`

export { SAMPLE_MENU as default }
