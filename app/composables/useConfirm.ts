interface ConfirmOptions {
  title: string
  message: string
  confirmText?: string
  cancelText?: string
  isDanger?: boolean
}

interface ConfirmState extends ConfirmOptions {
  isOpen: boolean
  resolve?: (value: boolean) => void
}

export function useConfirm() {
  const state = useState<ConfirmState>('app_confirm_modal', () => ({
    isOpen: false,
    title: '',
    message: '',
    confirmText: 'Confirmar',
    cancelText: 'Cancelar',
    isDanger: false,
  }))

  function confirm(options: ConfirmOptions): Promise<boolean> {
    return new Promise((resolve) => {
      state.value = {
        isOpen: true,
        title: options.title,
        message: options.message,
        confirmText: options.confirmText ?? 'Confirmar',
        cancelText: options.cancelText ?? 'Cancelar',
        isDanger: options.isDanger ?? false,
        resolve,
      }
    })
  }

  function handleConfirm() {
    state.value.resolve?.(true)
    state.value.isOpen = false
  }

  function handleCancel() {
    state.value.resolve?.(false)
    state.value.isOpen = false
  }

  return {
    state,
    confirm,
    handleConfirm,
    handleCancel,
  }
}
