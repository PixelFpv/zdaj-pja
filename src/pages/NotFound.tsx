import { Link } from 'react-router-dom';
import { Message } from '../components/Common';
import { useI18n } from '../i18n';

export function NotFound() {
  const { t } = useI18n();
  return (
    <Message title={t('notfound')}>
      <Link className="btn primary" to="/">{t('notfound.home')}</Link>
    </Message>
  );
}
