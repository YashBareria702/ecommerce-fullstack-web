# Order SMS setup

Quality Corner customer accounts now use a username and password. Login does not send an OTP or call MSG91.

Optional order SMS can still be enabled through MSG91. To send a confirmation to the customer and a new-order alert to the shop owner, fill these settings in the project-root `.env` file:

```dotenv
MSG91_AUTH_KEY=your_private_msg91_auth_key
MSG91_CUSTOMER_ORDER_TEMPLATE_ID=your_customer_order_template_id
MSG91_OWNER_ORDER_TEMPLATE_ID=your_shop_owner_order_template_id
STORE_OWNER_PHONE=91XXXXXXXXXX
```

Create two SMS Flow templates in MSG91. Both templates should define `VAR1` (customer name), `VAR2` (order number), and `VAR3` (order total in rupees). For India, the SMS content and sender ID may need approved DLT registration. Restart the backend after editing `.env`.

Suggested customer message: `Hi ##VAR1##, your Quality Corner order ##VAR2## worth Rs ##VAR3## is confirmed. It will be delivered to your doorstep shortly.`

Suggested owner message: `New Quality Corner order ##VAR2## from ##VAR1##. Order total: Rs ##VAR3##.`

Only use message text and sender details approved for your MSG91 account. MSG91 sends the order messages when a customer places an order; account creation and login remain free of OTP SMS.
