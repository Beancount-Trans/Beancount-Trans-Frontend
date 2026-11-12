import type { TagProps } from 'element-plus'

const accountTypeMap: Record<string, TagProps['type']> = {
    Assets: 'info',
    Expenses: 'info',
    Income: 'info',
    Liabilities: 'info',
    Equity: 'info',
    资产账户: 'info',
    支出账户: 'info',
    收入账户: 'info',
    负债账户: 'info',
    权益账户: 'info'
}

export const getAccountTypeColor = (type: string): TagProps['type'] => {
    return accountTypeMap[type] ?? 'info'
}

