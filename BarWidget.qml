import QtQuick
import qs.Commons
import qs.Ui
import "Model.js" as Model

// Market Clock: US equity session state and a countdown to the next session
// event, computed locally from the NYSE calendar in Model.js. No network.
//
// left   = switch between countdown and New York clock
// right  = send the full status as a desktop notification
// middle = recompute now
BarWidget {
  id: root
  moduleName: "io.github.terminalgravity.market-clock"

  readonly property bool extendedHours: setting("extendedHours", true) === true
  readonly property int urgentMinutes: Number(setting("urgentMinutes", 15))
  property string mode: setting("mode", "countdown") === "clock" ? "clock" : "countdown"
  onSettingsChanged: mode = setting("mode", "countdown") === "clock" ? "clock" : "countdown"

  property var session: Model.status(Date.now(), { extendedHours: extendedHours, urgentMinutes: urgentMinutes })
  readonly property bool hideWhenClosed: setting("hideWhenClosed", false) === true

  function refresh() {
    root.session = Model.status(Date.now(), { extendedHours: root.extendedHours, urgentMinutes: root.urgentMinutes })
  }

  onExtendedHoursChanged: refresh()
  onUrgentMinutesChanged: refresh()

  function notify() {
    if (!root.bar) return
    var lines = Model.tooltip(root.session).split("\n")
    var headline = lines.shift()
    root.bar.run("omarchy-notification-send -g " + Util.shellQuote("\uf201") + " "
      + Util.shellQuote(headline) + " " + Util.shellQuote(lines.join("\n")))
  }

  visible: !(hideWhenClosed && session.phase === "closed")
  implicitWidth: button.implicitWidth
  implicitHeight: button.implicitHeight

  // Recomputed every second; Model.status is a few date operations, no I/O.
  Timer {
    interval: 1000
    running: true
    repeat: true
    triggeredOnStart: true
    onTriggered: root.refresh()
  }

  WidgetButton {
    id: button
    anchors.fill: parent
    bar: root.bar
    // Vertical bars only fit a short tag.
    text: root.vertical ? root.session.tag.charAt(0) : Model.barLabel(root.session, root.mode)
    active: root.session.closingSoon
    dimmed: root.session.phase === "closed"
    tooltipText: Model.tooltip(root.session)
    onPressed: function(b) {
      if (b === Qt.RightButton) root.notify()
      else if (b === Qt.MiddleButton) root.refresh()
      else root.mode = root.mode === "clock" ? "countdown" : "clock"
    }
  }
}
