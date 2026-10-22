export function submissionErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message.toLowerCase() : "";

  if (message.includes("accepted submission is readonly")) {
    return "Сервер пока не разрешает комментарии к принятой работе. Попробуйте позже.";
  }
  if (message.includes("body or attachments required")) {
    return "Напишите комментарий или прикрепите файл.";
  }
  if (message.includes("submission not found") || message.includes("not found")) {
    return "Работа не найдена. Обновите страницу и попробуйте ещё раз.";
  }
  if (message.includes("unauthorized") || message.includes("forbidden")) {
    return "Нет доступа к этой работе. Обновите страницу или войдите снова.";
  }
  if (message.includes("failed to fetch") || message.includes("networkerror") || message.includes("network error")) {
    return "Нет связи с сервером. Проверьте подключение и повторите попытку.";
  }
  return "Произошла ошибка на сервере. Попробуйте ещё раз или обновите страницу.";
}
