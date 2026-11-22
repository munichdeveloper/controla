import de.atstck.controla.alerts.triage.FailureSignal;
import de.atstck.controla.alerts.triage.RuleBasedFailureTriageClassifier;
import java.io.BufferedReader;
import java.io.InputStreamReader;

/** Read normalized model inputs and print decisions from the actual CE implementation. */
public class Replay {
    private static Integer nullable(String value) {
        return value.equals("-1") ? null : Integer.valueOf(value);
    }

    public static void main(String[] args) throws Exception {
        var classifier = new RuleBasedFailureTriageClassifier();
        var input = new BufferedReader(new InputStreamReader(System.in));
        for (String line; (line = input.readLine()) != null;) {
            var fields = line.split(" ");
            var signal = new FailureSignal(null, null, nullable(fields[1]),
                    FailureSignal.ErrorCategory.valueOf(fields[2]),
                    Boolean.parseBoolean(fields[3]), nullable(fields[0]));
            System.out.println(classifier.classify(signal).decision());
        }
    }
}
