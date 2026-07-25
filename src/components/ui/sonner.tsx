import { Toaster as SonnerToaster } from "sonner";

const icons = {
  success: <i className="ph-fill ph-check-circle" />,
  info: <i className="ph-fill ph-info" />,
  warning: <i className="ph-fill ph-warning" />,
  error: <i className="ph-fill ph-warning-circle" />,
  loading: <i className="ph ph-spinner" />,
};

export function ScaffoldCmsToaster() {
  return (
    <SonnerToaster
      className="sc-toaster [font-family:Geist,_ui-sans-serif,_system-ui,_sans-serif] [--width:380px] max-[600px]:[--width:calc(100vw_-_32px)]"
      duration={3600}
      gap={10}
      icons={icons}
      mobileOffset={16}
      offset={24}
      position="bottom-right"
      toastOptions={{
        unstyled: true,
        classNames: {
          toast: "sc-toast",
          content: "sc-toast-content",
          title: "sc-toast-title",
          description: "sc-toast-description",
          icon: "sc-toast-icon",
        },
      }}
      visibleToasts={4}
    />
  );
}
