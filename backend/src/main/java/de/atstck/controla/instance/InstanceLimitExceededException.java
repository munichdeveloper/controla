package de.atstck.controla.instance;

/** A tenant has reached the instance limit of its active license. */
public class InstanceLimitExceededException extends IllegalStateException {

    public InstanceLimitExceededException(int maxInstances, String editionName) {
        super("Maximale Anzahl an Instanzen (" + maxInstances + ") für " + editionName + " erreicht.");
    }
}
