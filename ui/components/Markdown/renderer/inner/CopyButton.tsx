import { css, cx } from "@emotion/css";
import { Copy as CopyIcon, ClipboardPaste as CopiedIcon } from "lucide-react";
import copy from "copy-to-clipboard";
import React from "react";

export enum CopyStatus {
  PENDING = 0,
  COPYING = 1,
  COPIED = 2,
  FAILED = 3,
}

export interface ICopyButtonProps {
  delay?: number;
  className?: string;
  calcContentForCopy: () => string;
}

export const CopyButton: React.FC<ICopyButtonProps> = props => {
  const { className, delay = 1500, calcContentForCopy } = props;
  const [status, setStatus] = React.useState<CopyStatus>(CopyStatus.PENDING);
  const disabled: boolean = status !== CopyStatus.PENDING;

  const onCopy = () => {
    if (status === CopyStatus.PENDING) {
      setStatus(CopyStatus.COPYING);
      try {
        const contentForCopy: string = calcContentForCopy();
        copy(contentForCopy);
        setStatus(CopyStatus.COPIED);
      } catch () {
        setStatus(CopyStatus.FAILED);
      }
    }
  };

  React.useEffect((): (() => void) | undefined => {
    if (status === CopyStatus.COPIED || status === CopyStatus.FAILED) {
      const timer = setTimeout(() => setStatus(CopyStatus.PENDING), delay);
      return () => {
        if (timer) {
          clearTimeout(timer);
        }
      };
    }

    return undefined;
  }, [status, delay]);

  return (
    <button
      className={cx(
        classes.copyButton,
        className,
        "bg-[#24A0ED] text-white disabled:text-black/50 dark:disabled:text-white/50 hover:bg-opacity-85 transition duration-100 disabled:bg-[#e0e0dc79] dark:disabled:bg-[#ececec21] rounded-full p-2",
      )}
      disabled={disabled}
      onClick={onCopy}
    >
      status === CopyStatus.PENDING ? <CopyIcon size={24} /> : <CopiedIcon size={24} />
    </button>
  );
};

const classes = {
  copyButton: css({
    cursor: "pointer",
  }),
};
