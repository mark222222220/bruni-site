/* ==========================================================================
   ОПЛАТА КАРТОЙ
   --------------------------------------------------------------------------
   Сейчас это ДЕМО-режим: данные карты живут только в переменных JavaScript
   на время заполнения формы. Они НЕ отправляются на сервер и НЕ сохраняются
   ни в localStorage, ни в cookies, ни в sessionStorage. После оплаты или ухода
   со страницы форма очищается.

   ▸ ПОДКЛЮЧЕНИЕ НАСТОЯЩЕГО ЭКВАЙРИНГА — меняется только функция
     PaymentGateway.charge() ниже. Остальной сайт трогать не нужно:
     он вызывает charge() и ждёт ответ { ok: true, paymentId } или { ok: false, error }.

   Как это обычно делается (ЮKassa, CloudPayments, Т-Банк, Сбер и др.):
     1. Номер карты НЕ должен попадать на ваш сервер в открытом виде.
        Используйте JS-библиотеку банка: она превращает данные карты
        в одноразовый токен / криптограмму прямо в браузере
        (ЮKassa: Checkout.js → tokenize; CloudPayments: cp.Checkout → createPaymentCryptogram;
         Т-Банк: виджет / платёжная форма).
     2. Токен + номер заказа отправляются на ВАШ сервер (fetch POST /api/payments).
     3. Сервер с секретным ключом магазина создаёт платёж в API банка и
        возвращает статус или ссылку на 3-D Secure.
     4. Если нужен 3-D Secure — перенаправить покупателя (window.location = confirmationUrl),
        после возврата проверить статус заказа на сервере.
     5. Окончательное подтверждение оплаты — только по webhook-уведомлению банка на сервер.
     Альтернатива без своей формы: открыть готовый виджет банка в charge()
     и вернуть результат его колбэка.
   ========================================================================== */
(function () {
  "use strict";

  const PaymentGateway = {
    /* Режим работы. "demo" — имитация. Поставьте "live" после интеграции. */
    mode: "demo",

    /**
     * Провести оплату.
     * @param {object} order — { id, amount (руб.), currency: "RUB", email, phone, items }
     * @param {object} card  — { number, expMonth, expYear, cvc, holder } — ТОЛЬКО для передачи
     *                          в библиотеку токенизации банка. Никуда больше не отправлять.
     * @returns {Promise<{ok:boolean, paymentId?:string, error?:string}>}
     */
    async charge(order, card) {
      if (this.mode === "demo") {
        // Имитация ответа банка. Ничего никуда не уходит.
        await new Promise((r) => setTimeout(r, 2600));
        // Для проверки сценария ошибки: карта, оканчивающаяся на 0000, «отклоняется»
        if (card.number.endsWith("0000")) return { ok: false, error: "Банк отклонил операцию. Попробуйте другую карту." };
        return { ok: true, paymentId: "demo_" + Date.now().toString(36) };
      }

      /* ===== ЗДЕСЬ БУДЕТ НАСТОЯЩАЯ ОПЛАТА =====
       * Пример для схемы «токен в браузере → ваш сервер»:
       *
       * const token = await BankSDK.tokenize({
       *   number: card.number, month: card.expMonth, year: card.expYear, cvc: card.cvc, holder: card.holder
       * });
       * const res = await fetch("https://ваш-сервер/api/payments", {
       *   method: "POST",
       *   headers: { "Content-Type": "application/json" },
       *   body: JSON.stringify({ orderId: order.id, amount: order.amount, token })
       * }).then((r) => r.json());
       * if (res.confirmationUrl) { window.location.href = res.confirmationUrl; return new Promise(() => {}); }
       * return res.status === "succeeded" ? { ok: true, paymentId: res.id } : { ok: false, error: res.message };
       */
      throw new Error("Эквайринг не подключён");
    }
  };

  /* ---------- Утилиты для формы ---------- */
  const CardUtils = {
    digits: (s) => String(s || "").replace(/\D+/g, ""),

    brand(num) {
      const n = this.digits(num);
      if (/^220[0-4]/.test(n)) return "mir";
      if (/^4/.test(n)) return "visa";
      if (/^(5[1-5]|222[1-9]|22[3-9]\d|2[3-6]\d\d|27[01]\d|2720)/.test(n)) return "mastercard";
      if (/^(62|81)/.test(n)) return "unionpay";
      return "";
    },
    brandTitle: { mir: "МИР", visa: "VISA", mastercard: "Mastercard", unionpay: "UnionPay", "": "" },

    luhn(num) {
      const n = this.digits(num);
      if (n.length < 13 || n.length > 19) return false;
      let sum = 0, alt = false;
      for (let i = n.length - 1; i >= 0; i--) {
        let d = +n[i];
        if (alt) { d *= 2; if (d > 9) d -= 9; }
        sum += d; alt = !alt;
      }
      return sum % 10 === 0;
    },

    formatNumber(num) {
      const n = this.digits(num).slice(0, 19);
      return n.replace(/(\d{4})(?=\d)/g, "$1 ");
    },

    formatExp(v) {
      let n = this.digits(v).slice(0, 4);
      if (n.length === 1 && +n > 1) n = "0" + n;
      return n.length > 2 ? n.slice(0, 2) + " / " + n.slice(2) : n;
    },

    validExp(v) {
      const n = this.digits(v);
      if (n.length !== 4) return false;
      const m = +n.slice(0, 2), y = 2000 + +n.slice(2);
      if (m < 1 || m > 12) return false;
      const now = new Date();
      const end = new Date(y, m, 1); // первый день следующего месяца
      return end > now && y < now.getFullYear() + 15;
    }
  };

  window.PaymentGateway = PaymentGateway;
  window.CardUtils = CardUtils;
})();
