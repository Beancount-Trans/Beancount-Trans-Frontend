/**
 * 账户树展示辅助
 *
 * 后端已不再保存根账户（Beancount 不允许 `Assets` 这类路径），
 * `/account/tree/` 返回的是一级账户作为顶层节点。
 * 为了保持前端按五类账户分组的交互，这里在展示层合成虚拟根节点。
 */

export const ACCOUNT_ROOT_ORDER = [
  "Assets",
  "Liabilities",
  "Equity",
  "Income",
  "Expenses",
] as const;

const ROOT_TYPE_LABELS: Record<string, string> = {
  Assets: "资产账户",
  Liabilities: "负债账户",
  Equity: "权益账户",
  Income: "收入账户",
  Expenses: "支出账户",
};

export interface AccountTreeNode {
  id: number | string;
  account: string;
  account_type?: string;
  description?: string;
  enable?: boolean;
  parent?: number;
  parent_account?: string;
  mapping_count?: {
    expense: number;
    assets: number;
    income: number;
    total: number;
  };
  children?: AccountTreeNode[];
  is_virtual?: boolean;
  /** 账户由账本管理：路径、币种、删除需在账本处理（仅 Git 用户） */
  is_ledger_custodied?: boolean;
}

const isRootName = (account: string): boolean =>
  (ACCOUNT_ROOT_ORDER as readonly string[]).includes(account);

/**
 * 把一级账户按首段聚合成虚拟根节点。
 * 已存在的根账户（历史脏数据）会被忽略，避免重复展示。
 */
export function groupAccountsByRoot(
  accounts: AccountTreeNode[],
): AccountTreeNode[] {
  const groups = new Map<string, AccountTreeNode[]>();
  const others: AccountTreeNode[] = [];

  accounts.forEach((account) => {
    const root = account.account.split(":")[0];

    if (isRootName(account.account)) {
      return;
    }

    if (!(ACCOUNT_ROOT_ORDER as readonly string[]).includes(root)) {
      others.push(account);
      return;
    }

    const group = groups.get(root) ?? [];
    group.push(account);
    groups.set(root, group);
  });

  const grouped = ACCOUNT_ROOT_ORDER.filter((root) =>
    groups.has(root),
  ).map<AccountTreeNode>((root) => ({
    id: `root:${root}`,
    account: root,
    account_type: ROOT_TYPE_LABELS[root],
    enable: true,
    is_virtual: true,
    children: groups.get(root) ?? [],
  }));

  return [...grouped, ...others];
}
