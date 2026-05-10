import React, { forwardRef } from "react";

type MotionLikeProps = Record<string, any> & {
  children?: React.ReactNode;
};

const motionPropNames = new Set([
  "animate",
  "exit",
  "initial",
  "transition",
  "variants",
  "whileHover",
  "whileTap",
  "whileFocus",
  "whileDrag",
  "whileInView",
  "viewport",
  "layout",
  "layoutId",
  "layoutRoot",
  "layoutScroll",
  "drag",
  "dragConstraints",
  "dragElastic",
  "dragMomentum",
  "dragDirectionLock",
  "dragPropagation",
  "dragSnapToOrigin",
  "dragTransition",
  "dragControls",
  "dragListener",
  "onUpdate",
  "onAnimationStart",
  "onAnimationComplete",
  "onLayoutAnimationStart",
  "onLayoutAnimationComplete",
  "onDragStart",
  "onDrag",
  "onDragEnd",
  "onPan",
  "onPanStart",
  "onPanEnd",
  "onPanSessionStart",
  "onPanSessionEnd",
  "onTap",
  "onTapStart",
  "onTapCancel",
  "custom",
]);

const createMotionComponent = (tag: string) =>
  forwardRef<HTMLElement, MotionLikeProps>(function MotionShim(props, ref) {
    const filteredProps: Record<string, any> = {};

    for (const [key, value] of Object.entries(props)) {
      if (key === "children" || !motionPropNames.has(key)) {
        filteredProps[key] = value;
      }
    }

    return React.createElement(tag, { ...filteredProps, ref }, props.children as React.ReactNode);
  });

const motionHandler: ProxyHandler<Record<string, unknown>> = {
  get: (_target, prop) => {
    if (typeof prop !== "string") {
      return undefined;
    }

    return createMotionComponent(prop);
  },
};

export const motion: any = new Proxy({}, motionHandler);

export const AnimatePresence: React.FC<{ children?: React.ReactNode; [key: string]: any }> = ({ children }) => (
  <>{children}</>
);

export default motion;
