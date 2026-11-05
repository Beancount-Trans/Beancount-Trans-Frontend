import { driver } from "driver.js";
import "driver.js/dist/driver.css";

// 导览状态常量
export type TourStatus = 'not_started' | 'in_progress' | 'completed';
const TOUR_VERSION = '1.0.0';

// 导览状态存储键名
const STORAGE_KEYS = {
  STATUS: 'tour_status',
  CURRENT_STEP: 'tour_current_step',
  VERSION: 'tour_version',
  IN_PROGRESS: 'tour_in_progress' // sessionStorage
} as const;

/** 导览第三步默认引导用户解析的案例文件名，可改为 完整测试_微信.csv 以引导解析微信账单 */
export const TOUR_FIRST_PARSE_FILE_NAME = '完整测试_支付宝.csv';

/** 新用户目录中的示例账单文件名（与后端 sample_files 一致） */
export const SAMPLE_BILL_FILE_NAMES = ['完整测试_微信.csv', '完整测试_支付宝.csv'] as const;

export const BILLS_EXPORT_DOCS_URL =
  'https://trans.dhr2333.cn/docs/%E6%93%8D%E4%BD%9C%E6%8C%87%E5%8D%97/bills-export-methods/';

/** 示例账单公开下载地址（与账单解析页 Trans.vue 一致） */
export const SAMPLE_BILL_DOWNLOAD_URLS = {
  wechat: 'https://dl.dhr2333.cn/%E5%AE%8C%E6%95%B4%E6%B5%8B%E8%AF%95_%E5%BE%AE%E4%BF%A1.csv',
  alipay: 'https://dl.dhr2333.cn/%E5%AE%8C%E6%95%B4%E6%B5%8B%E8%AF%95_%E6%94%AF%E4%BB%98%E5%AE%9D.csv',
} as const;

// 创建引导实例
type DriverConfig = NonNullable<Parameters<typeof driver>[0]>
type DriverSteps = NonNullable<DriverConfig['steps']>
type DriverPopover = NonNullable<DriverSteps[number]['popover']>
type DriverStepSide = DriverPopover['side']

const driverObj = driver({
  showProgress: true,
  allowClose: false, // 禁用关闭按钮，强制完成导览
  allowKeyboardControl: false, // 禁用键盘控制，防止意外跳过
  onHighlighted: (element, step) => {
    // 每次步骤切换时更新进度（在步骤高亮后，此时索引已更新）
    const stepIndex = driverObj.getActiveIndex();
    if (stepIndex !== null && stepIndex !== undefined) {
      // 更新当前步骤进度（会触发自定义事件）
      saveTourProgress(stepIndex);
    }

    // 步骤三（索引2）时确保解析按钮可点击
    if (stepIndex === 2) {
      setTimeout(() => {
        // 确保解析按钮可以点击（提高 z-index 并确保 pointer-events）
        const parseButton = document.querySelector('.tour-parse-first-file');
        if (parseButton) {
          const buttonElement = parseButton as HTMLElement;
          // 确保按钮在遮罩层之上
          buttonElement.style.position = 'relative';
          buttonElement.style.zIndex = '10001';
          buttonElement.style.pointerEvents = 'auto';

          // 确保按钮的父元素也允许点击
          let parent = buttonElement.parentElement;
          while (parent && parent !== document.body) {
            parent.style.pointerEvents = 'auto';
            parent = parent.parentElement;
          }
        }
      }, 100);
    }
  },
  steps: [
    // 步骤 1：欢迎
    {
      popover: {
        title: '🎉 欢迎使用 Beancount-Trans',
        description: '我们已为您准备了示例账单文件，让我们一起体验如何将账单转换为专业财务报表！',
        side: 'center' as unknown as DriverStepSide,
        align: 'center'
        // 不定义 onNextClick，让 driver.js 使用默认行为
        // 进度更新在 onHighlighted 中处理
      }
    },

    // 步骤 2：文件列表
    {
      element: '#tour-file-table',
      popover: {
        title: '📁 示例文件',
        description: '这里有两个示例账单文件（微信、支付宝），当前状态为"未解析"。',
        side: 'top',
        align: 'start'
        // 不定义 onNextClick，让 driver.js 使用默认行为
        // 进度更新在 onHighlighted 中处理
      }
    },

    // 步骤 3：解析按钮
    {
      element: '.tour-parse-first-file',
      popover: {
        title: '⚡ 开始解析',
        description: '点击这个按钮，系统会自动将账单转换为 Beancount 格式。解析需要几秒钟，请稍等。',
        side: 'left',
        align: 'start',
        disableButtons: ['next'], // 禁用 Next 按钮，使用与步骤一 Previous 相同的效果
        onNextClick: () => {
          // 步骤三禁止 Next 操作，只允许用户点击解析按钮
          // 不执行任何操作，阻止继续
          return false;
        }
      }
    },

    // 步骤 4：立即处理（横幅按钮）
    {
      element: '#tour-task-banner-button',
      popover: {
        title: '✅ 解析完成',
        description: '解析已完成！系统已创建审核待办任务。点击"立即处理"查看并审核解析结果。',
        side: 'bottom',
        align: 'center',
        disableButtons: ['previous', 'next'], // 禁用 Previous 和 Next 按钮，使用与步骤一 Previous 相同的效果
        onPrevClick: () => {
          // 步骤四禁止 Previous 操作，因为解析操作已经完成
          // 返回上一步可能引入其他问题，所以阻止返回
          return false;
        },
        onNextClick: () => {
          // 步骤4（索引3）的 Next 会进入步骤5（索引4）
          // 但用户应该点击"立即处理"按钮，而不是 Next 按钮
          // 用户点击了 Next，跳转到待办列表
          sessionStorage.setItem(STORAGE_KEYS.IN_PROGRESS, 'true');
          driverObj.destroy();
          // 异步跳转到待办列表页面
          import('../routers').then(({ default: router }) => {
            router.push('/tasks');
          });
          // 进度更新在 onHighlighted 中处理（如果进入步骤5）
          // 但这里已经销毁了导览，所以不会触发 onHighlighted
          // 需要手动保存进度到步骤5（索引4）
          saveTourProgress(4);
        }
      }
    },

    // 步骤 5：Copilot / Fava
    {
      element: '#tour-ledger-menu',
      popover: {
        title: '📊 查看账本',
        description:
          '引导完成！顶栏「Copilot」用自然语言查账（只读，不改账）；「Fava」打开专业报表。',
        side: 'bottom',
        align: 'start',
        disableButtons: ['previous'], // 禁用 Previous 按钮，使用与步骤一 Previous 相同的效果
        onPrevClick: () => {
          // 步骤五禁止 Previous 操作，因为审核操作已经完成
          // 返回上一步可能引入其他问题，所以阻止返回
          return false;
        },
        onNextClick: () => {
          // 导览完成
          markTourCompleted();
          // markTourCompleted 会销毁导览，所以不会继续
        }
      }
    }
  ]
});

// 导览状态管理函数

/**
 * 保存导览进度
 */
export function saveTourProgress(stepIndex: number) {
  try {
    localStorage.setItem(STORAGE_KEYS.STATUS, 'in_progress');
    localStorage.setItem(STORAGE_KEYS.CURRENT_STEP, stepIndex.toString());
    localStorage.setItem(STORAGE_KEYS.VERSION, TOUR_VERSION);
    sessionStorage.setItem(STORAGE_KEYS.IN_PROGRESS, 'true');

    // 触发自定义事件，通知组件步骤已切换
    window.dispatchEvent(new CustomEvent('tour-step-changed', {
      detail: { stepIndex }
    }));
  } catch (error) {
    console.error('保存导览进度失败:', error);
  }
}

/**
 * 获取导览进度
 */
export function getTourProgress(): { status: TourStatus; currentStep: number; version: string } | null {
  try {
    const status = localStorage.getItem(STORAGE_KEYS.STATUS) as TourStatus | null;
    const currentStepStr = localStorage.getItem(STORAGE_KEYS.CURRENT_STEP);
    const version = localStorage.getItem(STORAGE_KEYS.VERSION) || TOUR_VERSION;

    if (!status || currentStepStr === null) {
      return null;
    }

    return {
      status,
      currentStep: parseInt(currentStepStr, 10),
      version
    };
  } catch (error) {
    console.error('获取导览进度失败:', error);
    return null;
  }
}

/**
 * 标记导览完成
 */
export function markTourCompleted() {
  try {
    localStorage.setItem(STORAGE_KEYS.STATUS, 'completed');
    localStorage.removeItem(STORAGE_KEYS.CURRENT_STEP);
    sessionStorage.removeItem(STORAGE_KEYS.IN_PROGRESS);
    localStorage.removeItem('start_tour');
    driverObj.destroy();
  } catch (error) {
    console.error('标记导览完成失败:', error);
  }
}

/**
 * 判断是否需要恢复导览
 */
export function shouldResumeTour(): boolean {
  const progress = getTourProgress();
  if (!progress) {
    return false;
  }
  return progress.status === 'in_progress';
}

/**
 * 初始化导览状态（新用户）
 */
export function initTourState() {
  try {
    localStorage.setItem(STORAGE_KEYS.STATUS, 'not_started');
    localStorage.setItem(STORAGE_KEYS.CURRENT_STEP, '0');
    localStorage.setItem(STORAGE_KEYS.VERSION, TOUR_VERSION);
  } catch (error) {
    console.error('初始化导览状态失败:', error);
  }
}

// 启动完整引导
export function startUserTour() {
  try {
    // 保存状态为进行中
    saveTourProgress(0);
    driverObj.drive();
  } catch (error) {
    console.error('启动用户引导失败:', error);
  }
}

// 继续引导（从步骤 4 开始 - 横幅立即处理按钮）
export function continueUserTour() {
  try {
    // 保存状态
    saveTourProgress(3);
    // 等待横幅渲染完成
    setTimeout(() => {
      // 从步骤 4 开始（索引为 3）- 横幅立即处理按钮
      driverObj.drive(3);
    }, 500);
  } catch (error) {
    console.error('继续用户引导失败:', error);
  }
}

// 继续引导到步骤 5（账本管理）
export function continueUserTourToStep5() {
  try {
    // 保存状态
    saveTourProgress(4);
    // 等待页面渲染完成
    setTimeout(() => {
      // 从步骤 5 开始（索引为 4）- 账本管理
      driverObj.drive(4);
    }, 500);
  } catch (error) {
    console.error('继续用户引导到步骤5失败:', error);
  }
}

/**
 * 从指定步骤恢复导览
 */
export function resumeTourFromStep(stepIndex: number) {
  try {
    saveTourProgress(stepIndex);
    setTimeout(() => {
      driverObj.drive(stepIndex);
    }, 500);
  } catch (error) {
    console.error(`从步骤 ${stepIndex} 恢复导览失败:`, error);
  }
}

// 销毁引导
export function destroyUserTour() {
  try {
    driverObj.destroy();
  } catch (error) {
    console.error('销毁用户引导失败:', error);
  }
}
