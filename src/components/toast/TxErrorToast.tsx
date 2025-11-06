import cx from 'clsx';
import { ToastContentProps } from 'react-toastify';

type CustomNotificationProps = ToastContentProps<{
  title: string;
  content: string;
}>;
export function TxErrorToast({ data, toastProps }: CustomNotificationProps) {
  const isColored = toastProps.theme === 'colored';
  return (
    <div className="flex w-full flex-col">
      <h3 className={cx('text-sm font-semibold', isColored ? 'text-white' : 'text-zinc-800')}>
        {data.title}
      </h3>
      <div className="flex items-center justify-between">
        <p className="text-sm">{data.content}</p>
      </div>
    </div>
  );
}
