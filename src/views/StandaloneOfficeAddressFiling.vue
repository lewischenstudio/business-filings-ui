<template>
  <div id="standalone-office-address">
    <ConfirmDialog
      attach="#standalone-office-address"
      ref="confirm"
    />

    <FetchErrorDialog
      attach="#standalone-office-address"
      :dialog="fetchErrorDialog"
      @exit="goToDashboard(true)"
    />

    <PaymentErrorDialog
      attach="#standalone-office-address"
      filingName="Address Change"
      :dialog="paymentErrorDialog"
      :errors="saveErrors"
      :warnings="saveWarnings"
      @exit="onPaymentErrorDialogExit()"
    />

    <ResumeErrorDialog
      attach="#standalone-office-address"
      :dialog="resumeErrorDialog"
      @exit="goToDashboard(true)"
    />

    <SaveErrorDialog
      attach="#standalone-office-address"
      filingName="Address Change"
      :dialog="!!saveErrorReason"
      :disableRetry="busySaving"
      :errors="saveErrors"
      :warnings="saveWarnings"
      @exit="saveErrorReason=null"
      @retry="onSaveErrorDialogRetry()"
      @okay="onSaveErrorDialogOkay()"
    />

    <StaffPaymentDialog
      attach="#standalone-office-address"
      :dialog="staffPaymentDialog"
      :staffPaymentData.sync="staffPaymentData"
      :loading="filingPaying"
      @exit="staffPaymentDialog=false"
      @submit="onClickFilePay(true)"
    />

    <!-- Initial Page Load Transition -->
    <v-fade-transition>
      <div class="loading-container" v-show="showLoadingContainer">
        <div class="loading__content">
          <v-progress-circular color="primary" :size="50" indeterminate></v-progress-circular>
          <div class="loading-msg">{{loadingMessage}}</div>
        </div>
      </div>
    </v-fade-transition>

    <!-- Alternate Loading Spinner -->
    <v-fade-transition>
      <div class="loading-container grayed-out" v-show="isFetching">
        <div class="loading__content">
          <v-progress-circular color="primary" size="50" indeterminate />
          <div class="loading-msg white--text">Fetching updated data</div>
        </div>
      </div>
    </v-fade-transition>

    <!-- Main Body -->
    <v-container id="standalone-office-address-container" class="view-container">
      <v-row>
        <v-col cols="12" lg="9">
          <article id="standalone-office-address-article">
            <header>
              <h1 id="address-change-header">Address Change</h1>

              <p>
                <span v-if="isCoop">Please change your Registered Office Address.</span>
                <span v-if="isBComp">Please change your Registered Office Address and Records Address.</span>
              </p>

              <v-alert type="info" outlined
                v-if="isBComp"
                icon="mdi-information"
                class="white-background"
              >
                <span>Any address update will be effective tomorrow.</span>
              </v-alert>
            </header>

            <!-- Office Addresses -->
            <section>
              <OfficeAddresses
                ref="officeAddressesComponent"
                :addresses.sync="updatedAddresses"
                @modified="officeModifiedEventHandler($event)"
                @valid="addressesFormValid=$event"
              />
            </section>

            <!-- Certify -->
            <section>
              <header>
                <h2 id="certify-header">Certify</h2>
                <p>Enter the legal name of the person authorized to complete and submit this
                  Address Change.</p>
              </header>
              <Certify
                :isCertified.sync="isCertified"
                :certifiedBy.sync="certifiedBy"
                :entityDisplay="displayName()"
                :message="certifyText(feeCode)"
                @valid="certifyFormValid=$event"
              />
            </section>
          </article>
        </v-col>

        <v-col cols="12" lg="3" style="position: relative">
          <aside>
            <affix
              relative-element-selector="#standalone-office-address-article"
              :offset="{ top: 120, bottom: 40 }"
            >
              <SbcFeeSummary
                :filingData="filingData"
                :payURL="payApiUrl"
                @total-fee="totalFee=$event"
              />
            </affix>
          </aside>
        </v-col>
      </v-row>
    </v-container>

    <!-- Buttons -->
    <v-container id="standalone-office-address-buttons-container" class="list-item">
      <div class="buttons-left">
        <v-btn
          id="coa-save-btn"
          large
          :disabled="!saveDraftAllowed || busySaving"
          :loading="saving"
          @click="onClickSave()"
        >
          <span>Save</span>
        </v-btn>
        <v-btn
          id="coa-save-resume-btn"
          large
          :disabled="!saveDraftAllowed || busySaving"
          :loading="savingResuming"
          @click="onClickSaveResume()"
        >
          <span>Save and Resume Later</span>
        </v-btn>
      </div>

      <div class="buttons-right">
        <v-tooltip top color="#3b6cff" content-class="top-tooltip">
          <template v-slot:activator="{ on }">
            <div v-on="on" class="d-inline">
            <v-btn
              id="coa-file-pay-btn"
              color="primary"
              large
              :disabled="!isPageValid || busySaving"
              :loading="filingPaying"
              @click="onClickFilePay()"
            >
              <span>{{isPayRequired ? "File and Pay" : "File Now (no fee)"}}</span>
            </v-btn>
            </div>
          </template>
          Ensure all of your information is entered correctly before you File.<br>
          There is no opportunity to change information beyond this point.
        </v-tooltip>

        <v-btn
          id="coa-cancel-btn"
          large
          :disabled="busySaving"
          @click="goToDashboard()"
        >
          <span>Cancel</span>
        </v-btn>
      </div>
    </v-container>
  </div>
</template>

<script lang="ts">
// Libraries
import { Component, Mixins, Watch } from 'vue-property-decorator'
import { Action, Getter, State } from 'vuex-class'
import { PAYMENT_REQUIRED } from 'http-status-codes'
import { isEmpty } from 'lodash'
import { navigate } from '@/utils'

// Components and dialogs
import SbcFeeSummary from 'sbc-common-components/src/components/SbcFeeSummary.vue'
import { Certify, OfficeAddresses } from '@/components/common'
import { ConfirmDialog, FetchErrorDialog, PaymentErrorDialog, ResumeErrorDialog, SaveErrorDialog,
  StaffPaymentDialog } from '@/components/dialogs'

// Mixins, enums and interfaces
import { CommonMixin, DateMixin, FilingMixin, LegalApiMixin, ResourceLookupMixin } from '@/mixins'
import { CorpTypeCd, FilingCodes, FilingTypes, Routes, SaveErrorReasons, StaffPaymentOptions } from '@/enums'
import { ActionBindingIF, ConfirmDialogType, FilingDataIF, StaffPaymentIF } from '@/interfaces'

@Component({
  components: {
    OfficeAddresses,
    SbcFeeSummary,
    Certify,
    ConfirmDialog,
    FetchErrorDialog,
    PaymentErrorDialog,
    ResumeErrorDialog,
    SaveErrorDialog,
    StaffPaymentDialog
  }
})
export default class StandaloneOfficeAddressFiling extends Mixins(
  CommonMixin, DateMixin, FilingMixin, LegalApiMixin, ResourceLookupMixin
) {
  // Refs
  $refs!: {
    confirm: ConfirmDialogType,
    officeAddressesComponent: OfficeAddresses
  }

  @State entityFoundingDate!: Date
  @State filingData!: Array<FilingDataIF>

  @Getter isBComp!: boolean
  @Getter isCoop!: boolean
  @Getter isRoleStaff!: boolean
  @Getter getCurrentDate!: string
  @Getter getEntityType!: CorpTypeCd
  @Getter getEntityName!: string
  @Getter getIdentifier!: string

  @Action setFilingData!: ActionBindingIF

  // variables
  private updatedAddresses: any = { registeredOffice: {}, recordsOffice: {} }
  private filingId: number = null
  private savedFiling: any = null // filing during save
  private loadingMessage = ''
  private dataLoaded = false
  private isFetching = false
  private fetchErrorDialog = false
  private paymentErrorDialog = false
  private resumeErrorDialog = false
  private saveErrorReason: SaveErrorReasons = null
  private staffPaymentDialog = false
  private coaDate = ''
  private isCertified = false
  private certifiedBy = ''
  private certifyFormValid = false
  private addressesFormValid: boolean = null
  private saving = false // true only when saving
  private savingResuming = false // true only when saving and resuming
  private filingPaying = false // true only when filing and paying
  private haveChanges = false
  private saveErrors = []
  private saveWarnings = []
  private totalFee = 0
  private staffPaymentData = { option: StaffPaymentOptions.NONE } as StaffPaymentIF

  /** True if loading container should be shown, else False. */
  get showLoadingContainer (): boolean {
    // show loading container when data isn't yet loaded and when
    // no dialogs are displayed (otherwise dialogs may be hidden)
    return (!this.dataLoaded && !this.fetchErrorDialog && !this.resumeErrorDialog &&
      !this.saveErrorReason && !this.paymentErrorDialog)
  }

  /** True if page is valid. */
  get isPageValid (): boolean {
    const filingDataValid = (this.filingData.length > 0)
    return (this.certifyFormValid && this.addressesFormValid && filingDataValid)
  }

  /** True if saving a draft is allowed. */
  get saveDraftAllowed (): boolean {
    const filingDataValid = (this.filingData.length > 0)
    return (this.addressesFormValid && filingDataValid)
  }

  /** True when saving, saving and resuming, or filing and paying. */
  get busySaving (): boolean {
    return (this.saving || this.savingResuming || this.filingPaying)
  }

  /** The Pay API URL string. */
  get payApiUrl (): string {
    return sessionStorage.getItem('PAY_API_URL')
  }

  /** The Auth URL string. */
  get authUrl (): string {
    return sessionStorage.getItem('AUTH_WEB_URL')
  }

  /** The Base URL string. */
  get baseUrl (): string {
    return sessionStorage.getItem('BASE_URL')
  }

  /** True if payment is required, else False. */
  get isPayRequired (): boolean {
    // FUTURE: modify rule here as needed
    return (this.totalFee > 0)
  }

  /** Local computed value for the fee code based on entity type */
  get feeCode (): FilingCodes {
    return this.isBComp ? FilingCodes.ADDRESS_CHANGE_BC : FilingCodes.ADDRESS_CHANGE_OT
  }

  /** Called when component is created. */
  created (): void {
    // init
    this.setFilingData([])

    // listen for fetch error events
    this.$root.$on('fetch-error-event', () => { this.fetchErrorDialog = true })

    // before unloading this page, if there are changes then prompt user
    window.onbeforeunload = (event) => {
      if (this.haveChanges) {
        event.preventDefault()
        // NB: custom text is not supported in all browsers
        event.returnValue = 'You have unsaved changes. Are you sure you want to leave?'
      }
    }

    // Filing ID may be 0, a number or NaN
    this.filingId = +this.$route.params.filingId
  }

  /** Called when component is mounted. */
  async mounted (): Promise<void> {
    // if tombstone data isn't set, go to dashboard
    if (!this.getIdentifier || isNaN(this.filingId)) {
      // eslint-disable-next-line no-console
      console.log('Standalone Office Address Filing error - missing Entity Inc No or Filing ID!')
      this.goToDashboard(true)
      return // don't continue
    }

    // wait until entire view is rendered (including all child components)
    // see https://v3.vuejs.org/api/options-lifecycle-hooks.html#mounted
    await this.$nextTick()

    // initial value
    // since user cannot change it from the UI, this will always be "today"
    this.coaDate = this.getCurrentDate

    if (this.filingId > 0) {
      // resume draft filing
      this.loadingMessage = 'Resuming Your Address Change'
      await this.fetchDraftFiling()
      // fetch original office addresses
      // update working data only if it wasn't in the draft
      if (!this.isJestRunning) {
        const isEmptyAddresses =
          (isEmpty(this.updatedAddresses.recordsOffice) && isEmpty(this.updatedAddresses.registeredOffice))
        await this.$refs.officeAddressesComponent.getOrigAddresses(this.coaDate, isEmptyAddresses)
      }
    } else {
      // this is a new filing
      this.loadingMessage = 'Preparing Your Address Change'
      // fetch original office addresses + update working data
      if (!this.isJestRunning) {
        await this.$refs.officeAddressesComponent.getOrigAddresses(this.coaDate, true)
      }
    }

    this.dataLoaded = true
  }

  destroyed (): void {
    // stop listening for custom events
    this.$root.$off('fetch-error-event')
  }

  async fetchDraftFiling (): Promise<void> {
    const url = `businesses/${this.getIdentifier}/filings/${this.filingId}`
    await this.fetchFiling(url).then(filing => {
      // verify data
      if (!filing) throw new Error('Missing filing')
      if (!filing.header) throw new Error('Missing header')
      if (!filing.business) throw new Error('Missing business')
      if (filing.header.name !== FilingTypes.CHANGE_OF_ADDRESS) throw new Error('Invalid filing type')
      if (filing.business.identifier !== this.getIdentifier) throw new Error('Invalid business identifier')
      if (filing.business.legalName !== this.getEntityName) throw new Error('Invalid business legal name')

      // restore Certified By (but not Date)
      this.certifiedBy = filing.header.certifiedBy

      // restore Staff Payment data
      if (filing.header.routingSlipNumber) {
        this.staffPaymentData = {
          option: StaffPaymentOptions.FAS,
          routingSlipNumber: filing.header.routingSlipNumber,
          isPriority: filing.header.priority
        } as StaffPaymentIF
      } else if (filing.header.bcolAccountNumber) {
        this.staffPaymentData = {
          option: StaffPaymentOptions.BCOL,
          bcolAccountNumber: filing.header.bcolAccountNumber,
          datNumber: filing.header.datNumber,
          folioNumber: filing.header.folioNumber,
          isPriority: filing.header.priority
        } as StaffPaymentIF
      } else if (filing.header.waiveFees) {
        this.staffPaymentData = {
          option: StaffPaymentOptions.NO_FEE
        } as StaffPaymentIF
      } else {
        this.staffPaymentData = {
          option: StaffPaymentOptions.NONE
        } as StaffPaymentIF
      }

      // do not restore COA Date
      // since user cannot change it from the UI, it will always be "today"

      // restore Change of Address data
      const changeOfAddress = filing.changeOfAddress
      if (changeOfAddress) {
        // registered office is required
        // records office is required for BCOMP only
        const registeredOffice = changeOfAddress.offices?.registeredOffice
        const recordsOffice = changeOfAddress.offices?.recordsOffice
        if (this.isBComp && registeredOffice && recordsOffice) {
          this.updatedAddresses = { registeredOffice, recordsOffice }
        } else if (!this.isBComp && registeredOffice) {
          this.updatedAddresses = { registeredOffice }
        } else {
          throw new Error('Invalid change of address object')
        }

        // update filing data
        // use existing Priority and Waive Fees flags
        this.updateFilingData('add', this.feeCode, this.staffPaymentData.isPriority,
          (this.staffPaymentData.option === StaffPaymentOptions.NO_FEE))
      } else {
        // changeOfAddress is optional
        // leave existing office addresses intact
      }
    }).catch(error => {
      // eslint-disable-next-line no-console
      console.log('fetchDraftFiling() error =', error)
      this.resumeErrorDialog = true
    })
  }

  /**
   * Callback method for the "modified" event from OfficeAddresses component.
   * @param modified a boolean indicating whether or not the office address(es) have been modified from their
   * original values.
   */
  officeModifiedEventHandler (modified: boolean): void {
    // only record changes once the initial data is loaded
    this.haveChanges = this.dataLoaded
    // when addresses change, update filing data
    // use existing Priority and Waive Fees flags
    this.updateFilingData(modified ? 'add' : 'remove', this.feeCode, this.staffPaymentData.isPriority,
      (this.staffPaymentData.option === StaffPaymentOptions.NO_FEE))
  }

  /**
   * Called when user clicks Save button
   * or when user retries from Save Error dialog.
   */
  async onClickSave (): Promise<void> {
    // prevent double saving
    if (this.busySaving) return

    this.saving = true

    // save draft filing
    this.savedFiling = await this.saveFiling(true).catch(error => {
      // try to return filing (which may exist depending on save error)
      return error?.response?.data?.filing || null
    })

    const filingId = +this.savedFiling?.header?.filingId || 0
    if (filingId > 0) {
      // save filing ID for possible future updates
      this.filingId = filingId
    }

    // if there was no error, finish save process now
    // otherwise, dialog may finish this later
    if (!this.saveErrorReason) this.onClickSaveFinish()

    this.saving = false
  }

  onClickSaveFinish (): void {
    // safety check
    if (this.filingId > 0) {
      // changes were saved, so clear flag
      this.haveChanges = false
    } else {
      // eslint-disable-next-line no-console
      console.log('onClickSaveFinish(): invalid filing ID, filing =', null)
    }
  }

  /**
   * Called when user clicks Save and Resume later button
   * or when user retries from Save Error dialog.
   */
  async onClickSaveResume (): Promise<void> {
    // prevent double saving
    if (this.busySaving) return

    this.savingResuming = true

    // save draft filing
    this.savedFiling = await this.saveFiling(true).catch(error => {
      this.saveErrorReason = SaveErrorReasons.SAVE_RESUME
      // try to return filing (which may exist depending on save error)
      return error?.response?.data?.filing || null
    })

    const filingId = +this.savedFiling?.header?.filingId || 0
    if (filingId > 0) {
      // save filing ID for possible future updates
      this.filingId = filingId
    }

    // if there was no error, finish save-resume process now
    // otherwise, dialog may finish this later
    if (!this.saveErrorReason) this.onClickSaveResumeFinish()

    this.savingResuming = false
  }

  onClickSaveResumeFinish (): void {
    // safety check
    if (this.filingId > 0) {
      // changes were saved, so go to dashboard
      this.goToDashboard(true)
    } else {
      // eslint-disable-next-line no-console
      console.log('onClickSaveResumeFinish(): invalid filing ID, filing =', null)
    }
  }

  /**
   * Called when user clicks File and Pay button
   * or when user retries from Save Error dialog
   * or when user submits from Staff Payment dialog.
   */
  async onClickFilePay (fromStaffPayment = false): Promise<void> {
    // prevent double saving
    if (this.busySaving) return

    // if this is a staff user clicking File and Pay (not Submit)
    // then detour via Staff Payment dialog
    if (this.isRoleStaff && !fromStaffPayment) {
      this.staffPaymentDialog = true
      return
    }

    this.filingPaying = true

    // save final filing (not draft)
    this.savedFiling = await this.saveFiling(false).catch(error => {
      if (error?.response?.status === PAYMENT_REQUIRED) {
        // changes were saved if a 402 is received, so clear flag
        this.haveChanges = false
        // display payment error dialog
        this.paymentErrorDialog = true
        // try to return filing (which should exist in this case)
        return error?.response?.data?.filing || null
      } else {
        this.saveErrorReason = SaveErrorReasons.FILE_PAY
        // try to return filing (which may exist depending on save error)
        return error?.response?.data?.filing || null
      }
    })

    const filingId = +this.savedFiling?.header?.filingId || 0
    if (filingId > 0) {
      // save filing ID for possible future updates
      this.filingId = filingId
    }

    // if there were no errors, finish file-pay process now
    // otherwise, dialogs may finish this later
    if (!this.paymentErrorDialog && !this.saveErrorReason) this.onClickFilePayFinish()

    this.filingPaying = false
  }

  onClickFilePayFinish (): void {
    // safety check
    if (this.filingId > 0) {
      // changes were saved, so clear flag
      this.haveChanges = false

      const isPaymentActionRequired = Boolean(this.savedFiling.header.isPaymentActionRequired)

      // if payment action is required, navigate to Pay URL
      if (isPaymentActionRequired) {
        const paymentToken = this.savedFiling.header.paymentToken
        const returnUrl = encodeURIComponent(this.baseUrl + '?filing_id=' + this.filingId)
        const payUrl = this.authUrl + 'makepayment/' + paymentToken + '/' + returnUrl
        // assume Pay URL is always reachable
        // otherwise, user will have to retry payment later
        navigate(payUrl)
      } else {
        // route to dashboard with filing id parameter
        this.$router.push({ name: Routes.DASHBOARD, query: { filing_id: this.filingId.toString() } })
      }
    } else {
      // eslint-disable-next-line no-console
      console.log('onClickFilePayFinish(): invalid filing ID, filing =', null)
    }
  }

  /** Builds and saves the filing. NB: Caller needs to catch exceptions. */
  async saveFiling (isDraft): Promise<any> {
    this.saveErrors = []
    this.saveWarnings = []

    // if this is a new filing, ensure there are no pending tasks
    if (this.filingId === 0) {
      const hasPendingTasks = await this.hasPendingTasks(this.getIdentifier)
        .catch(() => {
          this.saveErrors = [{ error: 'Unable to check server for pending tasks.' }]
          throw new Error()
        })

      if (hasPendingTasks) {
        this.saveErrors = [
          { error: 'Another draft filing already exists. Please complete it before creating a new filing.' }
        ]
        throw new Error()
      }
    }

    let changeOfAddress = null

    const header: any = {
      header: {
        name: FilingTypes.CHANGE_OF_ADDRESS,
        certifiedBy: this.certifiedBy || '',
        email: 'no_one@never.get',
        date: this.getCurrentDate, // NB: API will reassign this date according to its clock
        effectiveDate: this.yyyyMmDdToApi(this.coaDate)
      }
    }

    switch (this.staffPaymentData.option) {
      case StaffPaymentOptions.FAS:
        header.header['routingSlipNumber'] = this.staffPaymentData.routingSlipNumber
        header.header['priority'] = this.staffPaymentData.isPriority
        break

      case StaffPaymentOptions.BCOL:
        header.header['bcolAccountNumber'] = this.staffPaymentData.bcolAccountNumber
        header.header['datNumber'] = this.staffPaymentData.datNumber
        header.header['folioNumber'] = this.staffPaymentData.folioNumber
        header.header['priority'] = this.staffPaymentData.isPriority
        break

      case StaffPaymentOptions.NO_FEE:
        header.header['waiveFees'] = true
        break

      case StaffPaymentOptions.NONE: // should never happen
        break
    }

    const business: any = {
      business: {
        foundingDate: this.dateToApi(this.entityFoundingDate),
        identifier: this.getIdentifier,
        legalName: this.getEntityName,
        legalType: this.getEntityType
      }
    }

    if (this.hasFilingCode(FilingCodes.ADDRESS_CHANGE_OT)) {
      changeOfAddress = {
        changeOfAddress: {
          legalType: this.getEntityType,
          offices: {
            registeredOffice: this.updatedAddresses.registeredOffice
          }
        }
      }
    }

    if (this.hasFilingCode(FilingCodes.ADDRESS_CHANGE_BC)) {
      changeOfAddress = {
        changeOfAddress: {
          legalType: this.getEntityType,
          offices: {
            registeredOffice: this.updatedAddresses.registeredOffice,
            recordsOffice: this.updatedAddresses.recordsOffice
          }
        }
      }
    }

    // build filing data
    const data = Object.assign({}, header, business, changeOfAddress)

    try {
      let ret
      if (this.filingId > 0) {
        // we have a filing id, so update an existing filing
        ret = await this.updateFiling(this.getIdentifier, data, this.filingId, isDraft)
      } else {
        // filing id is 0, so create a new filing
        ret = await this.createFiling(this.getIdentifier, data, isDraft)
      }
      return ret
    } catch (error) {
      // save errors or warnings, if any
      this.saveErrors = error?.response?.data?.errors || []
      this.saveWarnings = error?.response?.data?.warnings || []
      throw error
    }
  }

  /**
   * Routes to dashboard if there are no outstanding changes,
   * else prompts user before routing.
   */
  goToDashboard (force: boolean = false): void {
    // check if there are no data changes
    if (!this.haveChanges || force) {
      // route to dashboard
      this.$router.push({ name: Routes.DASHBOARD })
        .catch(() => {}) // ignore error in case navigation was aborted
      return
    }

    // open confirmation dialog and wait for response
    this.$refs.confirm.open(
      'Unsaved Changes',
      'You have unsaved changes in your Change of Office Addresses. Do you want to exit your filing?',
      {
        width: '45rem',
        persistent: true,
        yes: 'Return to my filing',
        no: null,
        cancel: 'Exit without saving'
      }
    ).then(async (confirm) => {
      // if we get here, Yes was clicked
      // nothing to do
    }).catch(() => {
      // if we get here, Cancel was clicked
      // ignore changes
      this.haveChanges = false
      // route to dashboard
      this.$router.push({ name: Routes.DASHBOARD })
        .catch(() => {}) // ignore error in case navigation was aborted
    })
  }

  /** Handles Exit event from Payment Error dialog. */
  onPaymentErrorDialogExit (): void {
    if (this.isRoleStaff) {
      // close Payment Error dialog -- this
      // leaves user on Staff Payment dialog
      this.paymentErrorDialog = false
    } else {
      // close the dialog and go to dashboard --
      // user will have to retry payment from there
      this.paymentErrorDialog = false
      this.goToDashboard(true)
    }
  }

  /** Handles Retry events from Save Error dialog. */
  async onSaveErrorDialogRetry (): Promise<void> {
    switch (this.saveErrorReason) {
      case SaveErrorReasons.SAVE:
        // close the dialog and retry save
        this.saveErrorReason = null
        await this.onClickSave()
        break
      case SaveErrorReasons.SAVE_RESUME:
        // close the dialog and retry save-resume
        this.saveErrorReason = null
        await this.onClickSaveResume()
        break
      case SaveErrorReasons.FILE_PAY:
        // close the dialog and retry file-pay
        this.saveErrorReason = null
        if (this.isRoleStaff) await this.onClickFilePay(true)
        else await this.onClickFilePay()
        break
    }
  }

  /** Handles Okay events from Save Error dialog. */
  onSaveErrorDialogOkay (): void {
    switch (this.saveErrorReason) {
      case SaveErrorReasons.SAVE:
        // close the dialog and finish save process
        this.saveErrorReason = null
        this.onClickSaveFinish()
        break
      case SaveErrorReasons.SAVE_RESUME:
        // close the dialog and finish save-resume process
        this.saveErrorReason = null
        this.onClickSaveResumeFinish()
        break
      case SaveErrorReasons.FILE_PAY:
        // close the dialog and finish file-pay process
        this.saveErrorReason = null
        this.onClickFilePayFinish()
        break
    }
  }

  // FOR FUTURE USE (since COA date cannot be changed, this method is not called atm)
  @Watch('coaDate')
  async onCoaDateChhanged (): Promise<void> {
    // ignore changes before data is loaded
    if (!this.dataLoaded) return null

    // fetch original office addresses with new date + update working data
    // (this will overwrite the current data)
    this.isFetching = true
    if (!this.isJestRunning) {
      await this.$refs.officeAddressesComponent.getOrigAddresses(this.coaDate, true)
    }
    this.isFetching = false
  }

  @Watch('isCertified')
  onIsCertifiedChanged (val: boolean): void {
    // only record changes once the initial data is loaded
    this.haveChanges = this.dataLoaded
  }

  @Watch('certifiedBy')
  onCertifiedByChanged (val: string): void {
    // only record changes once the initial data is loaded
    this.haveChanges = this.dataLoaded
  }

  @Watch('staffPaymentData')
  onStaffPaymentDataChanged (val: StaffPaymentIF): void {
    const waiveFees = (val.option === StaffPaymentOptions.NO_FEE)

    // apply Priority flag to OTADD filing code only
    // if OTADD code exists, simply re-add it with the updated Priority flag and existing Waive Fees flag
    if (this.hasFilingCode(FilingCodes.ADDRESS_CHANGE_OT)) {
      this.updateFilingData('add', FilingCodes.ADDRESS_CHANGE_OT, val.isPriority, waiveFees)
    }

    // add/remove Waive Fees flag to/from all filing codes
    this.updateFilingData(waiveFees ? 'add' : 'remove', undefined, undefined, true)

    // only record changes once the initial data is loaded
    this.haveChanges = this.dataLoaded
  }
}
</script>

<style lang="scss" scoped>
@import '@/assets/styles/theme.scss';

article {
  .v-card {
    line-height: 1.2rem;
    font-size: $px-14;
  }
}

header p,
section p {
  color: $gray6;
}

section + section {
  margin-top: 3rem;
}

h1 {
  margin-bottom: 1.25rem;
  line-height: 2rem;
  letter-spacing: -0.01rem;
}

h2 {
  margin-bottom: 0.25rem;
  margin-top: 3rem;
  font-size: 1.125rem;
}

// Save & Filing Buttons
#standalone-office-address-buttons-container {
  padding-top: 2rem;
  border-top: 1px solid $gray5;

  .buttons-left {
    width: 50%;
  }

  .buttons-right {
    margin-left: auto;
  }

  .v-btn + .v-btn {
    margin-left: 0.5rem;
  }

  #coa-cancel-btn {
    margin-left: 0.5rem;
  }
}

.loading-container.grayed-out {
  // these are the same styles as dialog overlay:
  opacity: 0.46;
  background-color: rgb(33, 33, 33); // grey darken-4
  border-color: rgb(33, 33, 33); // grey darken-4
}
</style>
