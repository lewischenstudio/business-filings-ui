import { BreadCrumb } from '@bcrs-shared-components/bread-crumb'
import Certify from './Certify.vue'
import ContactInfo from './ContactInfo.vue'
import DateTooltip from './DateTooltip.vue'
import DetailComment from './DetailComment.vue'
import DetailsList from './DetailsList.vue'
import NameRequestInfo from './NameRequestInfo.vue'
import OfficeAddresses from './OfficeAddresses.vue'
import { StaffPayment } from '@bcrs-shared-components/staff-payment'
import SummaryDirectors from './SummaryDirectors.vue'
import SummaryOfficeAddresses from './SummaryOfficeAddresses.vue'

// NB: importing/exporting Directors gives us weird errors,
// possibly due to some circular dependency, so don't do it

export {
  BreadCrumb,
  Certify,
  ContactInfo,
  DateTooltip,
  DetailComment,
  DetailsList,
  NameRequestInfo,
  OfficeAddresses,
  StaffPayment,
  SummaryDirectors,
  SummaryOfficeAddresses
}
