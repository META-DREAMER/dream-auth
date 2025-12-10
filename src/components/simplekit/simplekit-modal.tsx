"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { useMediaQuery } from "@/hooks/use-media-query";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import { ScrollArea } from "@/components/ui/scroll-area";

interface BaseProps {
  children: React.ReactNode;
}

interface RootSimpleKitModalProps extends BaseProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

interface SimpleKitModalProps extends BaseProps {
  className?: string;
  asChild?: true;
}

const desktop = "(min-width: 768px)";

const SimpleKitModal = ({ children, ...props }: RootSimpleKitModalProps) => {
  const isDesktop = useMediaQuery(desktop);
  const SimpleKitModalComponent = isDesktop ? Dialog : Drawer;

  return <SimpleKitModalComponent {...props}>{children}</SimpleKitModalComponent>;
};

const SimpleKitModalTrigger = ({
  className,
  children,
  ...props
}: SimpleKitModalProps) => {
  const isDesktop = useMediaQuery(desktop);
  const SimpleKitModalTriggerComponent = isDesktop ? DialogTrigger : DrawerTrigger;

  return (
    <SimpleKitModalTriggerComponent className={className} {...props}>
      {children}
    </SimpleKitModalTriggerComponent>
  );
};

const SimpleKitModalClose = ({
  className,
  children,
  ...props
}: SimpleKitModalProps) => {
  const isDesktop = useMediaQuery(desktop);
  const SimpleKitModalCloseComponent = isDesktop ? DialogClose : DrawerClose;

  return (
    <SimpleKitModalCloseComponent className={className} {...props}>
      {children}
    </SimpleKitModalCloseComponent>
  );
};

const SimpleKitModalContent = ({
  className,
  children,
  ...props
}: SimpleKitModalProps) => {
  const isDesktop = useMediaQuery(desktop);
  const SimpleKitModalContentComponent = isDesktop ? DialogContent : DrawerContent;

  return (
    <SimpleKitModalContentComponent
      className={cn(
        "rounded-t-3xl sm:rounded-3xl md:max-w-[360px] [&>button]:right-[26px] [&>button]:top-[26px]",
        className,
      )}
      onOpenAutoFocus={(e) => e.preventDefault()}
      {...props}
    >
      {children}
    </SimpleKitModalContentComponent>
  );
};

const SimpleKitModalDescription = ({
  className,
  children,
  ...props
}: SimpleKitModalProps) => {
  const isDesktop = useMediaQuery(desktop);
  const SimpleKitModalDescriptionComponent = isDesktop
    ? DialogDescription
    : DrawerDescription;

  return (
    <SimpleKitModalDescriptionComponent className={className} {...props}>
      {children}
    </SimpleKitModalDescriptionComponent>
  );
};

const SimpleKitModalHeader = ({
  className,
  children,
  ...props
}: SimpleKitModalProps) => {
  const isDesktop = useMediaQuery(desktop);
  const SimpleKitModalHeaderComponent = isDesktop ? DialogHeader : DrawerHeader;

  return (
    <SimpleKitModalHeaderComponent
      className={cn("space-y-0 pb-6 md:pb-3", className)}
      {...props}
    >
      {children}
    </SimpleKitModalHeaderComponent>
  );
};

const SimpleKitModalTitle = ({
  className,
  children,
  ...props
}: SimpleKitModalProps) => {
  const isDesktop = useMediaQuery(desktop);
  const SimpleKitModalTitleComponent = isDesktop ? DialogTitle : DrawerTitle;

  return (
    <SimpleKitModalTitleComponent className={cn("text-center", className)} {...props}>
      {children}
    </SimpleKitModalTitleComponent>
  );
};

const SimpleKitModalBody = ({
  className,
  children,
  ...props
}: SimpleKitModalProps) => {
  return (
    <ScrollArea
      className={cn(
        "h-[234px] max-h-[300px] px-6 md:-mr-4 md:h-full md:min-h-[260px] md:px-0 md:pr-4",
        className,
      )}
      {...props}
    >
      {children}
    </ScrollArea>
  );
};

const SimpleKitModalFooter = ({
  className,
  children,
  ...props
}: SimpleKitModalProps) => {
  const isDesktop = useMediaQuery(desktop);
  const SimpleKitModalFooterComponent = isDesktop ? DialogFooter : DrawerFooter;

  return (
    <SimpleKitModalFooterComponent
      className={cn("py-3.5 md:py-0", className)}
      {...props}
    >
      {children}
    </SimpleKitModalFooterComponent>
  );
};

export {
  SimpleKitModal,
  SimpleKitModalTrigger,
  SimpleKitModalClose,
  SimpleKitModalContent,
  SimpleKitModalDescription,
  SimpleKitModalHeader,
  SimpleKitModalTitle,
  SimpleKitModalBody,
  SimpleKitModalFooter,
};
