import clsx, { ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export const cn = (...classes: ClassValue[]) => twMerge(clsx(...classes));

export const formatTimeDifference = (date1: Date | string, date2: Date | string): string => {
  date1 = new Date(date1);
  date2 = new Date(date2);

  const diffInSeconds = Math.floor(Math.abs(date2.getTime() - date1.getTime()) / 1000);

  if (diffInSeconds < 60) return `${diffInSeconds} second${diffInSeconds === 1 ? "" : "s"}`;
  else if (diffInSeconds < 3600)
    return `${Math.floor(diffInSeconds / 60)} minute${Math.floor(diffInSeconds / 60) === 1 ? "" : "s"}`;
  else if (diffInSeconds < 86_400)
    return `${Math.floor(diffInSeconds / 3600)} hour${Math.floor(diffInSeconds / 3600) === 1 ? "" : "s"}`;
  else if (diffInSeconds < 31_536_000)
    return `${Math.floor(diffInSeconds / 86_400)} day${Math.floor(diffInSeconds / 86_400) === 1 ? "" : "s"}`;
  else
    return `${Math.floor(diffInSeconds / 31_536_000)} year${Math.floor(diffInSeconds / 31_536_000) === 1 ? "" : "s"}`;
};
